import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import {
  TABLES,
  appBase,
  type ClientFields,
  type PlanFields,
} from "@/lib/airtable"
import { createNotification } from "@/app/actions/notifications"

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ""

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
    const client = clients[0]

    if (client) {
      const current = client.fields["Credits Remaining"] ?? 0
      await appBase.update<ClientFields>(TABLES.clients, client.id, {
        "Credits Remaining": Math.round((current + creditAmount) * 100) / 100,
      })
    }

    // Create a Plan record in Airtable
    const planName =
      itemType === "pack"
        ? `${rawCount}-Pack`
        : `Single ${sessionType?.replace("private-", "")}min`

    await appBase.create<PlanFields>(TABLES.plans, {
      "User ID": userId,
      "Member Email": userEmail ?? "",
      "Plan Name": planName,
      Sessions: creditAmount,
      Status: "Active",
      "Price Paid": pricePaid,
      Source: "stripe",
    })

    // In-app notification
    const newBalance = Math.round(((client?.fields["Credits Remaining"] ?? 0) + creditAmount) * 100) / 100
    createNotification({
      userId,
      type: "booking_confirmed",
      title: "Purchase complete!",
      body: `Your ${planName} is ready. You have ${newBalance} credit${newBalance !== 1 ? "s" : ""} available.`,
    }).catch(() => {})
  }

  return NextResponse.json({ received: true })
}
