import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { TABLES, appBase, type ClientFields } from "@/lib/airtable"
import { db } from "@/lib/db"
import { parentActiveChild } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parentEmail = session.user.email.trim().toLowerCase()
  const safe = parentEmail.replace(/'/g, "\\'")

  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `LOWER({Parent Email}) = '${safe}'`,
    revalidate: 0,
  })

  if (records.length === 0) return NextResponse.json({ children: [] })

  // Look up which child is currently selected
  const [sel] = await db.select().from(parentActiveChild).where(eq(parentActiveChild.parentUserId, session.user.id)).limit(1)
  const selectedChildId = sel?.childUserId ?? records[0].fields["User ID"] ?? null

  const children = records.map((r) => ({
    userId: r.fields["User ID"] ?? "",
    name: r.fields.Name ?? "",
    email: r.fields.Email ?? "",
    creditsRemaining: r.fields["Credits Remaining"] ?? 0,
  }))

  return NextResponse.json({ children, selectedChildId })
}
