// Shared types, constants, and utilities for CDP web and mobile apps.
// No server-only imports allowed here.

// ---------------------------------------------------------------------------
// Packages & pricing
// ---------------------------------------------------------------------------

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

export const SINGLE_HOUR_PRICE = 119

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

export const PER_PRIVATE: PerPrivate[] = [
  { id: "private-30", name: "30 Minute", minutes: 30, price: 65 },
  { id: "private-45", name: "45 Minute", minutes: 45, price: 89 },
  { id: "private-60", name: "Hour", minutes: 60, price: 119 },
]

export function formatPrice(amount: number) {
  return `$${amount.toLocaleString("en-US")}`
}

// ---------------------------------------------------------------------------
// Shared data types (mirrors Airtable shapes, safe to use on client/mobile)
// ---------------------------------------------------------------------------

export type MemberPlan = {
  id: string
  userId: string
  planName: string
  sessions: number
  pricePaid: number
  purchasedAt: string
  expiresAt: string
  status: string
}

export type UserRole = "admin" | "prep_master" | "dancer"

export type Booking = {
  id: string
  date: string
  time: string
  status: string
  prepMasterName: string
  notes: string
}

// ---------------------------------------------------------------------------
// Plan utilities
// ---------------------------------------------------------------------------

export function planDisplayStatus(plan: MemberPlan): string {
  if (plan.status === "Active" && plan.expiresAt && new Date(plan.expiresAt) < new Date()) {
    return "Inactive"
  }
  return plan.status
}

export function planExpiryLabel(plan: MemberPlan): string {
  if (!plan.expiresAt) return ""
  const d = new Date(plan.expiresAt)
  return `Expires ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
}
