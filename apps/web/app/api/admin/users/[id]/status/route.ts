import { NextResponse } from "next/server"
import { getSessionUserWithRole } from "@/lib/roles"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createNotification } from "@/app/actions/notifications"

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

  await db.update(userTable).set({ status, updatedAt: new Date() }).where(eq(userTable.id, id))

  // Notify the user
  const title = status === "active" ? "Account approved!" : "Account not approved"
  const body = status === "active"
    ? "Your College Dance Prep account has been approved. You can now book sessions."
    : "Your account request was not approved. Contact us if you think this is a mistake."

  createNotification({ userId: id, type: `account_${status}`, title, body }).catch(() => {})

  return NextResponse.json({ ok: true })
}
