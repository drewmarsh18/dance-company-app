import { NextResponse } from "next/server"
import { getSessionUserWithRole } from "@/lib/roles"
import { adminUpdateMemberParentEmail } from "@/lib/airtable"
import { sendEmail, parentInviteEmail } from "@/lib/email"

// PATCH /api/admin/members/[id]/parent — set or clear a member's parent email.
// `id` here is the Airtable record ID of the member.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUserWithRole()
  if (me?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { parentEmail, memberName } = await req.json() as { parentEmail: string; memberName?: string }

  await adminUpdateMemberParentEmail(id, parentEmail.trim())

  let emailError: string | null = null
  if (parentEmail.trim()) {
    const childName = memberName ?? "your child"
    const { subject, html } = parentInviteEmail({ childName, parentEmail: parentEmail.trim() })
    try {
      await sendEmail({ to: parentEmail.trim(), subject, html })
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e)
      console.error("[parent invite] email failed:", emailError)
    }
  }

  return NextResponse.json({ ok: true, emailError })
}
