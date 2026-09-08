import { NextResponse } from "next/server"
import { getSessionUserWithRole } from "@/lib/roles"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { appBase, TABLES, type ClientFields } from "@/lib/airtable"

// DELETE /api/member/delete-account — lets the authenticated user permanently delete their own account
export async function DELETE(_req: Request) {
  const me = await getSessionUserWithRole()
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Clear User ID from any linked Airtable record so it's not orphaned
  try {
    const records = await appBase.list<ClientFields>(TABLES.clients, {
      filterByFormula: `{User ID} = '${me.id.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
      revalidate: 0,
    })
    if (records[0]) {
      await appBase.update<ClientFields>(TABLES.clients, records[0].id, { "User ID": "" })
    }
  } catch {
    // Non-fatal — proceed with deletion
  }

  // Deleting the user cascades to sessions and accounts via FK
  await db.delete(userTable).where(eq(userTable.id, me.id))

  return NextResponse.json({ ok: true })
}
