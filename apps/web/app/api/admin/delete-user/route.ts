import { NextResponse } from "next/server"
import { getSessionUserWithRole } from "@/lib/roles"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { appBase, TABLES, type ClientFields } from "@/lib/airtable"

export async function DELETE(req: Request) {
  const me = await getSessionUserWithRole()
  if (me?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })

  const normalizedEmail = email.trim().toLowerCase()

  // Delete from Postgres
  const deleted = await db
    .delete(userTable)
    .where(eq(userTable.email, normalizedEmail))
    .returning({ id: userTable.id })

  // Delete from Airtable (find by email, then destroy)
  let airtableDeleted = 0
  let parentEmail: string | null = null
  try {
    const records = await appBase.list<ClientFields>(TABLES.clients, {
      filterByFormula: `LOWER({Email}) = '${normalizedEmail.replace(/'/g, "\\'")}'`,
      maxRecords: 10,
    })
    parentEmail = records[0]?.fields?.["Parent Email"] ?? null
    await Promise.all(records.map((r) => appBase.destroy(TABLES.clients, r.id)))
    airtableDeleted = records.length
  } catch {
    // Non-fatal: log but don't fail if Airtable delete errors
  }

  // Also delete the linked parent account from Postgres if one exists
  let parentDeleted = 0
  if (parentEmail) {
    const normalizedParent = parentEmail.trim().toLowerCase()
    const result = await db
      .delete(userTable)
      .where(eq(userTable.email, normalizedParent))
      .returning({ id: userTable.id })
    parentDeleted = result.length
  }

  return NextResponse.json({ deleted: deleted.length, airtableDeleted, parentDeleted })
}
