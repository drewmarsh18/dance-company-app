import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { isAdminEmail } from "@/lib/roles"
import {
  adminAddCredits,
  createMemberPlan,
  getActivePlanForUser,
  setPlanStatus,
  appBase,
  TABLES,
} from "@/lib/airtable"
import { PACKAGES } from "@/lib/packages"

const SINGLE_SESSION_PLANS: Record<string, { name: string; price: number }> = {
  "60 min": { name: "60-Min Single", price: 119 },
  "45 min": { name: "45-Min Single", price: 89 },
  "30 min": { name: "30-Min Single", price: 65 },
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { memberId, userId, email, currentCredits, packageId, label } = body

  if (label) {
    // Add single session
    const sessionPlan = SINGLE_SESSION_PLANS[label]
    if (!sessionPlan) return NextResponse.json({ error: "Invalid session label." }, { status: 400 })
    const plan = await createMemberPlan({
      userId,
      memberEmail: email,
      planName: sessionPlan.name,
      sessions: 1,
      pricePaid: sessionPlan.price,
    })
    await adminAddCredits(memberId, currentCredits, 1)
    return NextResponse.json({ plan })
  }

  if (packageId) {
    // Assign package plan
    const pkg = PACKAGES.find((p) => p.id === packageId)
    if (!pkg) return NextResponse.json({ error: "Invalid package." }, { status: 400 })
    const existingActive = await getActivePlanForUser(userId)
    if (existingActive) await setPlanStatus(existingActive.id, "Inactive")
    const plan = await createMemberPlan({
      userId,
      memberEmail: email,
      planName: pkg.name,
      sessions: pkg.sessions,
      pricePaid: pkg.price,
      expiryDays: pkg.expiryDays,
    })
    await adminAddCredits(memberId, currentCredits, pkg.sessions)
    return NextResponse.json({ plan })
  }

  return NextResponse.json({ error: "Must provide packageId or label." }, { status: 400 })
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { planId, memberId, planSessions, currentCredits } = await req.json()
  await appBase.destroy(TABLES.plans, planId)
  const newCredits = Math.max(0, currentCredits - planSessions)
  await appBase.update(TABLES.clients, memberId, { "Credits Remaining": newCredits })
  return NextResponse.json({ ok: true, newCredits })
}
