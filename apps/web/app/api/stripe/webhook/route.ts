import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { stripe } from "@/lib/stripe"
import {
  TABLES,
  appBase,
  createMemberPlan,
  type ClientFields,
} from "@/lib/airtable"
import { PACKAGES } from "@cdp/core"
import { createNotification } from "@/app/actions/notifications"
import { sendEmail, purchaseReceiptEmail } from "@/lib/email"
import { db } from "@/lib/db"
import { stripeWebhookProcessed } from "@/lib/db/schema"

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
if (!WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET env var is not set")

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature") ?? ""

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)
  } catch (err) {
    console.error("Stripe webhook signature failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object
    const { userId, userEmail, itemId, itemType, sessions, sessionType } =
      session.metadata ?? {}

    if (!userId || !sessions) {
      console.error("Webhook missing metadata", session.metadata)
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 })
    }

    // Idempotency — Stripe may retry delivery; use a Postgres unique insert to atomically
    // claim this session. If two deliveries race, only one will succeed the insert.
    const stripeSessionId = session.id
    try {
      await db.insert(stripeWebhookProcessed).values({ stripeSessionId, userId })
    } catch {
      // Unique constraint violation — already processed
      return NextResponse.json({ received: true })
    }

    // For packs, metadata `sessions` is the credit count directly.
    // For single sessions, duration determines fractional credits (30min=0.5, 45min=0.75, 60min=1).
    const SINGLE_SESSION_CREDITS: Record<string, number> = {
      "private-30": 0.5,
      "private-45": 0.75,
      "private-60": 1,
      "private-90": 1.5,
    }
    const rawCount = parseInt(sessions, 10)
    const creditAmount =
      itemType === "pack"
        ? rawCount
        : (sessionType ? (SINGLE_SESSION_CREDITS[sessionType] ?? rawCount) : rawCount)
    const pricePaid = (session.amount_total ?? 0) / 100

    // Find the member's Airtable record by User ID
    const safeId = userId.replace(/'/g, "\\'")
    const clients = await appBase.list<ClientFields>(TABLES.clients, {
      filterByFormula: `{User ID} = '${safeId}'`,
      maxRecords: 1,
    })
    let client = clients[0]

    // New members may not have an Airtable record yet — create one so credits land
    if (!client && userEmail) {
      client = await appBase.create<ClientFields>(TABLES.clients, {
        Name: userEmail.split("@")[0],
        Email: userEmail,
        "User ID": userId,
        "Credits Remaining": 0,
      })
    }

    const priorBalance = client ? (client.fields["Credits Remaining"] ?? 0) : 0
    const newBalance = Math.round((priorBalance + creditAmount) * 100) / 100
    if (client) {
      await appBase.update<ClientFields>(TABLES.clients, client.id, {
        "Credits Remaining": newBalance,
      })
    }

    // Create a Plan record in Airtable with the correct expiry
    const planName =
      itemType === "pack"
        ? `${rawCount}-Pack`
        : `Single ${sessionType?.replace("private-", "")}min`

    const matchedPackage = itemType === "pack"
      ? PACKAGES.find((p) => p.id === itemId) ?? PACKAGES.find((p) => p.sessions === rawCount)
      : undefined

    await createMemberPlan({
      userId,
      memberEmail: userEmail ?? "",
      planName,
      sessions: creditAmount,
      pricePaid,
      source: "stripe",
      stripeSessionId,
      ...(matchedPackage?.expiryDays != null ? { expiryDays: matchedPackage.expiryDays } : {}),
    })

    // Bust the member's cached dashboard/profile data so the new credits show immediately
    revalidateTag(`member-${userId}`)

    // In-app + push notification
    createNotification({
      userId,
      type: "purchase_complete",
      title: "Purchase complete!",
      body: `Your ${planName} is ready. You have ${newBalance} credit${newBalance !== 1 ? "s" : ""} available.`,
      pushData: { route: "/member/plans" },
    }).catch(() => {})

    // Purchase receipt email — dancer is `to:`, parent CC'd if one exists
    if (userEmail) {
      const memberName = (client?.fields?.Name as string | undefined) ?? userEmail
      const parentCC = (client?.fields?.["Parent Email"] as string | undefined) ?? undefined
      const { subject, html } = purchaseReceiptEmail({ memberName, planName, creditAmount, pricePaid, newBalance })
      sendEmail({ to: userEmail, cc: parentCC, subject, html }).catch(() => {})
    }
  }

  return NextResponse.json({ received: true })
}
