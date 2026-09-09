import { NextResponse } from "next/server"
import { getSessionUserWithRole } from "@/lib/roles"
import { db } from "@/lib/db"
import { user as userTable, prepMasterInvite } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createNotification } from "@/app/actions/notifications"
import { sendPushToUser } from "@/lib/push"
import { appBase, TABLES } from "@/lib/airtable"
import type { ClientFields } from "@/lib/airtable"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUserWithRole()
  if (me?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { status } = await req.json() as { status: "active" | "denied" }
  if (status !== "active" && status !== "denied") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const [target] = await db.select().from(userTable).where(eq(userTable.id, id)).limit(1)
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

  await db.update(userTable).set({ status, updatedAt: new Date() }).where(eq(userTable.id, id))

  // Check if this user is a PrepMaster — they must not get a member (client) record
  let isPrepMaster = false
  try {
    const [invite] = await db
      .select({ id: prepMasterInvite.id })
      .from(prepMasterInvite)
      .where(eq(prepMasterInvite.email, target.email.toLowerCase()))
      .limit(1)
    isPrepMaster = Boolean(invite)
  } catch { /* non-fatal */ }

  // When approving a member (not a PrepMaster), ensure an Airtable client record exists.
  // Skip if this email is already a Parent Email on someone else's record — they're a parent
  // account and should see their child's profile, not get their own member record.
  if (status === "active" && !isPrepMaster) {
    try {
      const safeEmail = target.email.toLowerCase().replace(/'/g, "\\'")
      const [existing, asParent] = await Promise.all([
        appBase.list<ClientFields>(TABLES.clients, {
          filterByFormula: `{User ID} = '${id.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
          revalidate: 0,
        }),
        appBase.list<ClientFields>(TABLES.clients, {
          filterByFormula: `LOWER({Parent Email}) = '${safeEmail}'`,
          maxRecords: 1,
          revalidate: 0,
        }),
      ])
      const isParent = asParent.length > 0
      if (existing.length === 0 && !isParent) {
        await appBase.create<ClientFields>(TABLES.clients, {
          Name: target.name,
          Email: target.email,
          "User ID": id,
          "Credits Remaining": 0,
        })
      }
    } catch {
      // Non-fatal — member will be created on first dashboard load
    }
  }

  // Notify the user
  const title = status === "active" ? "Account approved!" : "Account not approved"
  const body = status === "active"
    ? isPrepMaster
      ? "Your College Dance Prep account has been approved. You can now access the PrepMaster portal."
      : "Your College Dance Prep account has been approved. You can now book sessions."
    : "Your account request was not approved. Contact us if you think this is a mistake."

  createNotification({ userId: id, type: `account_${status}`, title, body }).catch(() => {})
  sendPushToUser(id, { title, body, data: { type: `account_${status}` } }).catch(() => {})

  return NextResponse.json({ ok: true })
}
