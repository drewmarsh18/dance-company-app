// Pricing data for College Dance Prep.
//
// IMPORTANT: Prices live ONLY in app code and the dancer-facing dashboard.
// They are never written to Airtable, so prep masters (staff records in
// Airtable) can never see what a dancer paid. When Stripe is connected, map
// each `id` to a Stripe Price ID and create Checkout Sessions server-side.

export type DancePackage = {
  id: string
  name: string
  sessions: number
  price: number
  perSession: number
  savings: number
  /** Days from purchase date before the plan expires. */
  expiryDays: number
  features: string[]
  highlight?: boolean
}

export type PerPrivate = {
  id: string
  name: string
  minutes: number
  price: number
}

// Single hourly private rate, used to show per-package savings context.
export const SINGLE_HOUR_PRICE = 119

// Hourly private packages. Every hour in a package is $99 vs. $119 single.
export const PACKAGES: DancePackage[] = [
  {
    id: "pack-5",
    name: "5 Pack",
    sessions: 5,
    price: 495,
    perSession: 99,
    savings: 100,
    expiryDays: 180,
    features: [
      "5 hourly private sessions",
      "Book with any prep master",
      "Session notes & feedback",
    ],
  },
  {
    id: "pack-10",
    name: "10 Pack",
    sessions: 10,
    price: 990,
    perSession: 99,
    savings: 200,
    expiryDays: 180,
    highlight: true,
    features: [
      "10 hourly private sessions",
      "Priority booking windows",
      "Progress tracking",
    ],
  },
  {
    id: "pack-15",
    name: "15 Pack",
    sessions: 15,
    price: 1485,
    perSession: 99,
    savings: 300,
    expiryDays: 365,
    features: [
      "15 hourly private sessions",
      "Priority booking windows",
      "Personalized training plan",
    ],
  },
  {
    id: "pack-20",
    name: "20 Pack",
    sessions: 20,
    price: 1980,
    perSession: 99,
    savings: 400,
    expiryDays: 365,
    features: [
      "20 hourly private sessions",
      "Priority booking windows",
      "Personalized training plan",
    ],
  },
  {
    id: "pack-25",
    name: "25 Pack",
    sessions: 25,
    price: 2475,
    perSession: 99,
    savings: 500,
    expiryDays: 365,
    features: [
      "25 hourly private sessions",
      "Best per-session value",
      "Audition-ready training plan",
    ],
  },
]

// One-off private sessions.
export const PER_PRIVATE: PerPrivate[] = [
  { id: "private-30", name: "30 Minute", minutes: 30, price: 65 },
  { id: "private-45", name: "45 Minute", minutes: 45, price: 89 },
  { id: "private-60", name: "Hour", minutes: 60, price: 119 },
]

export function formatPrice(amount: number) {
  return `$${amount.toLocaleString("en-US")}`
}
