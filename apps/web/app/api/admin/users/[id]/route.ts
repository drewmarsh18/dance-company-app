import { NextResponse } from "next/server"
import { getSessionUserWithRole } from "@/lib/roles"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { appBase, TABLES, type ClientFields } from "@/lib/airtable"

// DELETE /api/admin/users/[id] — permanently delete a user account + clear Airtable link
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUserWithRole()
  if (me?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  // Fetch user to get their email before deleting
  const [target] = await db.select().from(userTable).where(eq(userTable.id, id)).limit(1)
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Clear User ID from any linked Airtable record so it's not orphaned
  try {
    const records = await appBase.list<ClientFields>(TABLES.clients, {
      filterByFormula: `{User ID} = '${id.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
      revalidate: 0,
    })
    if (records[0]) {
      await appBase.update<ClientFields>(TABLES.clients, records[0].id, { "User ID": "" })
    }
  } catch {
    // Non-fatal — proceed with auth deletion
  }

  // Deleting the user cascades to sessions and accounts via FK
  await db.delete(userTable).where(eq(userTable.id, id))

  return NextResponse.json({ ok: true })
}
