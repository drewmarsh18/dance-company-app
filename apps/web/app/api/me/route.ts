import { NextResponse } from "next/server"
import { getSessionUserWithRole } from "@/lib/roles"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { TABLES, appBase, type ClientFields } from "@/lib/airtable"

export async function PATCH(req: Request) {
  const user = await getSessionUserWithRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { timezone } = await req.json() as { timezone?: string }
  if (!timezone || typeof timezone !== "string") return NextResponse.json({ error: "Invalid timezone" }, { status: 400 })
  await db.update(userTable).set({ timezone }).where(eq(userTable.id, user.id))
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const user = await getSessionUserWithRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [row] = await db.select({ status: userTable.status }).from(userTable).where(eq(userTable.id, user.id))
  // Default to "pending" when no row found — never let an unknown user through as active
  const status = row?.status ?? "pending"

  // Check if this user is a parent (has children linked via Parent Email in Airtable)
  let isParent = false
  try {
    const safe = user.email.trim().toLowerCase().replace(/'/g, "\\'")
    const children = await appBase.list<ClientFields>(TABLES.clients, {
      filterByFormula: `LOWER({Parent Email}) = '${safe}'`,
      maxRecords: 1,
      revalidate: 0,
    })
    isParent = children.length > 0
  } catch { /* non-fatal */ }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status,
    isParent,
  })
}
