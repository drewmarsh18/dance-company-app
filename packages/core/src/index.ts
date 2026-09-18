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
    id: "pack-4",
    name: "4 Pack",
    sessions: 4,
    price: 425,
    perSession: 106,
    savings: 51,
    expiryDays: 180,
    features: [
      "4 hourly private sessions",
      "Book with any Prep Master",
      "Save $51 vs. individual sessions",
    ],
  },
  {
    id: "pack-8",
    name: "8 Pack",
    sessions: 8,
    price: 830,
    perSession: 104,
    savings: 122,
    expiryDays: 180,
    features: [
      "8 hourly private sessions",
      "Book with any Prep Master",
      "Save $122 vs. individual sessions",
    ],
  },
  {
    id: "pack-12",
    name: "12 Pack",
    sessions: 12,
    price: 1200,
    perSession: 100,
    savings: 228,
    expiryDays: 365,
    features: [
      "12 hourly private sessions",
      "Book with any Prep Master",
      "Save $228 vs. individual sessions",
    ],
  },
  {
    id: "pack-16",
    name: "16 Pack",
    sessions: 16,
    price: 1520,
    perSession: 95,
    savings: 384,
    expiryDays: 365,
    highlight: true,
    features: [
      "16 hourly private sessions",
      "Book with any Prep Master",
      "Save $384 vs. individual sessions",
    ],
  },
  {
    id: "pack-20",
    name: "20 Pack",
    sessions: 20,
    price: 1880,
    perSession: 94,
    savings: 500,
    expiryDays: 365,
    features: [
      "20 hourly private sessions",
      "Book with any Prep Master",
      "Save $500 vs. individual sessions",
    ],
  },
]

export const PER_PRIVATE: PerPrivate[] = [
  { id: "private-30", name: "30 Minute", minutes: 30, price: 65 },
  { id: "private-45", name: "45 Minute", minutes: 45, price: 89 },
  { id: "private-60", name: "Hour", minutes: 60, price: 119 },
  { id: "private-90", name: "90 Minute", minutes: 90, price: 169 },
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
