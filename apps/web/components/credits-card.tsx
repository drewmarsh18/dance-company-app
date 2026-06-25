"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Ticket, Package } from "lucide-react"
import { planDisplayStatus } from "@/lib/plan-utils"
import type { MemberPlan, CompCredit } from "@/lib/airtable"
import type { Booking } from "@/app/actions/booking"

const LABEL_TO_TYPES: Record<string, string[]> = {
  "60 min": ["private-60", "pack-hour"],
  "45 min": ["private-45"],
  "30 min": ["private-30"],
}

function isCompCreditUsed(credit: CompCredit, bookings: Booking[]) {
  const matchTypes = LABEL_TO_TYPES[credit.label] ?? []
  // Compare date-only strings to avoid time-of-day mismatch with grantedAt timestamp
  const grantedDateStr = credit.grantedAt.split("T")[0]
  return bookings.some(
    (b) =>
      b.status.toLowerCase() !== "cancelled" &&
      b.sessionType !== null &&
      matchTypes.includes(b.sessionType) &&
      b.date >= grantedDateStr,
  )
}

function singleSessionLabel(label: string) {
  return label === "60 min" ? "60-Min Single Session"
    : label === "45 min" ? "45-Min Single Session"
    : "30-Min Single Session"
}

export function CreditsCard({
  plans,
  compCredits,
  bookings,
  credits,
}: {
  plans: MemberPlan[]
  compCredits: CompCredit[]
  bookings: Booking[]
  credits: number
}) {
  const [view, setView] = useState<"active" | "history">("active")

  const activePlans = plans.filter((p) => planDisplayStatus(p) === "Active")
  const usedPlans = plans.filter((p) => planDisplayStatus(p) === "Used")

  const availableSingles = compCredits.filter((c) => !isCompCreditUsed(c, bookings))
  const usedSingles = compCredits.filter((c) => isCompCreditUsed(c, bookings))

  const hasActive = activePlans.length > 0 || availableSingles.length > 0
  const hasHistory = usedPlans.length > 0 || usedSingles.length > 0
  const isEmpty = credits === 0 && compCredits.length === 0 && plans.length === 0

  const shownPlans = view === "active" ? activePlans : usedPlans
  const shownSingles = view === "active" ? availableSingles : usedSingles

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Ticket className="size-4 text-primary" />
            Session credits
          </span>
          {(hasActive && hasHistory) && (
            <div className="flex gap-0.5 rounded-md border bg-muted p-0.5">
              <button
                onClick={() => setView("active")}
                className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${view === "active" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Active
              </button>
              <button
                onClick={() => setView("history")}
                className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${view === "history" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                History
              </button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isEmpty ? (
          <p className="text-sm text-muted-foreground">Purchase a package to start booking.</p>
        ) : shownPlans.length === 0 && shownSingles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {view === "active" ? "No active credits." : "No used credits yet."}
          </p>
        ) : null}

        {shownPlans.map((plan) => {
          const status = planDisplayStatus(plan)
          const expiryDate = plan.expiresAt
            ? new Date(plan.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : null
          return (
            <div key={plan.id} className="flex flex-col gap-1 rounded-md border px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <Package className="size-3.5 shrink-0 text-primary" />
                  {plan.planName}
                  <span className="font-normal text-muted-foreground">{plan.sessions} credits</span>
                </span>
                <Badge
                  variant="outline"
                  className={`capitalize text-xs ${status === "Active" ? "border-green-300 bg-green-100 text-green-700" : "border-amber-300 bg-amber-100 text-amber-700"}`}
                >
                  {status}
                </Badge>
              </div>
              {expiryDate && (
                <p className="pl-5 text-xs text-muted-foreground">Expires {expiryDate}</p>
              )}
            </div>
          )
        })}

        {shownSingles.map((c, i) => {
          const used = view === "history"
          return (
            <div key={i} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <Ticket className="size-3.5 shrink-0 text-muted-foreground" />
                {singleSessionLabel(c.label)}
                <span className="font-normal text-muted-foreground">{used ? "0 of 1" : "1 of 1"} credits</span>
              </span>
              <Badge
                variant="outline"
                className={`text-xs ${used ? "border-amber-300 bg-amber-100 text-amber-700" : "border-green-300 bg-green-100 text-green-700"}`}
              >
                {used ? "Used" : "Available"}
              </Badge>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
