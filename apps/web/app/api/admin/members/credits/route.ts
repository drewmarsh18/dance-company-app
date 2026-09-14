import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { isAdminEmail } from "@/lib/roles"
import { appBase, TABLES, type ClientFields } from "@/lib/airtable"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { memberId, newCredits } = await req.json()
  if (typeof memberId !== "string" || !memberId) return NextResponse.json({ error: "Invalid memberId." }, { status: 400 })
  if (typeof newCredits !== "number" || newCredits < 0 || newCredits > 9999) {
    return NextResponse.json({ error: "Invalid credit amount." }, { status: 400 })
  }
  // Verify the record exists in the Clients table before writing
  const records = await appBase.list<ClientFields>(TABLES.clients, { filterByFormula: `RECORD_ID() = '${memberId}'`, maxRecords: 1, revalidate: 0 })
  if (!records[0]) return NextResponse.json({ error: "Member not found." }, { status: 404 })
  await appBase.update<ClientFields>(TABLES.clients, memberId, { "Credits Remaining": newCredits })
  return NextResponse.json({ ok: true })
}
