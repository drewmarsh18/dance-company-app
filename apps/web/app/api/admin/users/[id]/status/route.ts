import { NextResponse } from "next/server"
import { getSessionUserWithRole } from "@/lib/roles"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createNotification } from "@/app/actions/notifications"
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

  // When approving, ensure an Airtable member record exists
  if (status === "active") {
    try {
      const existing = await appBase.list<ClientFields>(TABLES.clients, {
        filterByFormula: `{User ID} = '${id.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
        revalidate: 0,
      })
      if (existing.length === 0) {
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
    ? "Your College Dance Prep account has been approved. You can now book sessions."
    : "Your account request was not approved. Contact us if you think this is a mistake."

  createNotification({ userId: id, type: `account_${status}`, title, body }).catch(() => {})

  return NextResponse.json({ ok: true })
}
