import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { isAdminEmail } from "@/lib/roles"
import { adminCreateMember } from "@/lib/airtable"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { name, email, phone, goals, creditsRemaining } = body
  if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: "Email is required." }, { status: 400 })

  const member = await adminCreateMember({ name: name.trim(), email: email.trim(), phone: phone?.trim(), goals: goals?.trim(), creditsRemaining: Math.max(0, parseInt(creditsRemaining, 10) || 0) })
  return NextResponse.json({ member })
}
