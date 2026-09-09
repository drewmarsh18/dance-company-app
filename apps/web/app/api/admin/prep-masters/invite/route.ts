import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { randomUUID } from "crypto"
import { auth } from "@/lib/auth"
import { getSessionUserWithRole } from "@/lib/roles"
import { db } from "@/lib/db"
import { prepMasterInvite } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { sendEmail, prepMasterInviteEmail } from "@/lib/email"

export async function POST(req: Request) {
  const me = await getSessionUserWithRole()
  if (me?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { email, name } = await req.json() as { email: string; name: string }
  if (!email?.trim() || !name?.trim()) {
    return NextResponse.json({ error: "Email and name are required." }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Upsert invite record
  const existing = await db
    .select({ id: prepMasterInvite.id, status: prepMasterInvite.status })
    .from(prepMasterInvite)
    .where(eq(prepMasterInvite.email, normalizedEmail))
    .limit(1)

  const session = await auth.api.getSession({ headers: await headers() })
  const invitedBy = session?.user?.email ?? "admin"

  if (existing[0]) {
    await db
      .update(prepMasterInvite)
      .set({ status: "pending", name: name.trim(), invitedBy })
      .where(eq(prepMasterInvite.email, normalizedEmail))
  } else {
    await db.insert(prepMasterInvite).values({
      id: randomUUID(),
      email: normalizedEmail,
      name: name.trim(),
      invitedBy,
      status: "pending",
    })
  }

  const { subject, html } = prepMasterInviteEmail({ name: name.trim(), email: normalizedEmail })
  try {
    await sendEmail({ to: normalizedEmail, subject, html })
  } catch (e) {
    const emailError = e instanceof Error ? e.message : String(e)
    console.error("[prepmaster invite] email failed:", emailError)
    return NextResponse.json({ ok: true, emailError })
  }

  return NextResponse.json({ ok: true })
}
