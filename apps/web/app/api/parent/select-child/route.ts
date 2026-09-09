import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { TABLES, appBase, type ClientFields } from "@/lib/airtable"
import { db } from "@/lib/db"
import { parentActiveChild } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { childUserId } = await req.json() as { childUserId: string }
  if (!childUserId) return NextResponse.json({ error: "childUserId required" }, { status: 400 })

  // Verify the requested child is actually linked to this parent
  const parentEmail = session.user.email.trim().toLowerCase()
  const safe = parentEmail.replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `AND(LOWER({Parent Email}) = '${safe}', {User ID} = '${childUserId.replace(/'/g, "\\'")}')`,
    maxRecords: 1,
    revalidate: 0,
  })
  if (records.length === 0) return NextResponse.json({ error: "Child not linked to this account" }, { status: 403 })

  await db
    .insert(parentActiveChild)
    .values({ parentUserId: session.user.id, childUserId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: parentActiveChild.parentUserId,
      set: { childUserId, updatedAt: new Date() },
    })

  return NextResponse.json({ ok: true })
}
