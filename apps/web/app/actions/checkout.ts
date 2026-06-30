"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { stripe, APP_URL } from "@/lib/stripe"
import { PACKAGES, PER_PRIVATE } from "@/lib/packages"

export async function createCheckoutSession(itemId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/")

  // Find the item — could be a pack or a per-private session
  const pkg = PACKAGES.find((p) => p.id === itemId)
  const perPrivate = !pkg ? PER_PRIVATE.find((s) => s.id === itemId) : null
  const item = pkg ?? perPrivate
  if (!item) throw new Error("Unknown item: " + itemId)

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: item.price * 100, // Stripe uses cents
          product_data: {
            name: pkg
              ? `${pkg.name} — ${pkg.sessions} hourly private sessions`
              : `${perPrivate!.name} private session`,
            description: pkg
              ? `${pkg.sessions} one-on-one prep sessions with your choice of PrepMaster`
              : `${perPrivate!.minutes}-minute one-on-one prep session`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: session.user.id,
      userEmail: session.user.email,
      itemId,
      itemType: pkg ? "pack" : "per-private",
      sessions: pkg ? String(pkg.sessions) : "1",
      sessionType: pkg ? "pack-hour" : perPrivate!.id,
    },
    customer_email: session.user.email,
    success_url: `${APP_URL}/dashboard/packages/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/dashboard/packages`,
  })

  redirect(checkoutSession.url!)
}
