import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { updateProfile } from "@/app/actions/profile"
import { resolveRole } from "@/lib/roles"

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = await resolveRole(session.user.email)
  if (role === "prep_master") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { recordId, name, phone, goals, parentEmail } = body

  if (!recordId) return NextResponse.json({ error: "recordId required" }, { status: 400 })

  const result = await updateProfile({ recordId, name: name ?? "", phone: phone ?? "", goals: goals ?? "", parentEmail: parentEmail ?? undefined, memberName: session.user.name ?? undefined })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json({ ok: true })
}
