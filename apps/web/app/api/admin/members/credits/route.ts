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
  if (typeof newCredits !== "number" || newCredits < 0 || newCredits > 9999) {
    return NextResponse.json({ error: "Invalid credit amount." }, { status: 400 })
  }
  await appBase.update<ClientFields>(TABLES.clients, memberId, { "Credits Remaining": newCredits })
  return NextResponse.json({ ok: true })
}
