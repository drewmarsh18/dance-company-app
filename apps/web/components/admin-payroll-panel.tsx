"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ChevronDown, ChevronUp, DollarSign, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AdminWorker, AdminBooking } from "@/lib/airtable"
import { PER_PRIVATE, PACKAGES } from "@/lib/packages"
import { BookingFilterBar, applyFilters, type SortDir } from "@/components/booking-filter-bar"

const PACK_SESSION_PRICE = PACKAGES[0].perSession // $99
const PRICE_POINTS = [
  { label: "Pack hour", revenue: PACK_SESSION_PRICE },
  ...PER_PRIVATE.map((s) => ({ label: `${s.name} per-private`, revenue: s.price })),
]

type Props = {
  workers: AdminWorker[]
  bookings: AdminBooking[]
  query?: string
}

function formatMoney(cents: number) {
  return `$${cents.toFixed(2)}`
}

export function AdminPayrollPanel({ workers, bookings, query = "" }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const activeWorkers = workers.filter((w) => w.active)
  const filtered = query.trim()
    ? activeWorkers.filter((w) => w.name.toLowerCase().includes(query.toLowerCase()) || w.email.toLowerCase().includes(query.toLowerCase()))
    : activeWorkers

  if (activeWorkers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <DollarSign className="size-10 text-muted-foreground" />
          <p className="font-medium">No active Prep Masters</p>
          <p className="text-sm text-muted-foreground">
            Prep Masters will appear here once they are added to the Workers table in Airtable.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {filtered.length === 0 && activeWorkers.length > 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">No Prep Masters match &ldquo;{query}&rdquo;.</p>
      )}
      {filtered.map((worker) => {
        const isOpen = expanded === worker.id
        const workerBookings = bookings.filter(
          (b) => b.prepMasterName === worker.name,
        )
        const completedBookings = workerBookings.filter(
          (b) => b.status.toLowerCase() !== "cancelled",
        )

        const payPerSession = worker.hourlyRate
        const totalPay = payPerSession * completedBookings.length
        const totalRevenue = PACK_SESSION_PRICE * completedBookings.length
        const margin = totalRevenue - totalPay

        return (
          <Card key={worker.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-base">{worker.name}</CardTitle>
                  <CardDescription>{worker.email}{worker.region ? ` · ${worker.region}` : ""}</CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatMoney(totalPay)}</p>
                    <p className="text-xs text-muted-foreground">{completedBookings.length} session{completedBookings.length === 1 ? "" : "s"}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                    onClick={() => setExpanded(isOpen ? null : worker.id)}
                  >
                    {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isOpen && (
              <CardContent className="flex flex-col gap-5 pt-0">
                <Separator />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Pay rate / session" value={formatMoney(payPerSession)} />
                  <StatTile label="Total sessions" value={String(completedBookings.length)} />
                  <StatTile label="Total pay owed" value={formatMoney(totalPay)} highlight />
                  <StatTile label="Revenue (pack)" value={formatMoney(totalRevenue)} sub={`Margin ${formatMoney(margin)}`} />
                </div>

                {/* Margin by session type */}
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Margin by session type</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
                    {PRICE_POINTS.map(({ label, revenue }) => {
                      const m = revenue - payPerSession
                      const isNeg = m < 0
                      return (
                        <div key={label} className="flex flex-col">
                          <span className="text-[11px] text-muted-foreground">{label}</span>
                          <span className="text-sm font-semibold">
                            {formatMoney(revenue)}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">charged</span>
                          </span>
                          <span className={`text-xs font-medium ${isNeg ? "text-destructive" : "text-green-600"}`}>
                            {isNeg ? "−" : "+"}{formatMoney(Math.abs(m))} margin
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <PayrollBookingList bookings={workerBookings} payPerSession={payPerSession} />
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function PayrollBookingList({
  bookings,
  payPerSession,
}: {
  bookings: AdminBooking[]
  payPerSession: number
}) {
  const [monthKey, setMonthKey] = useState("")
  const [sort, setSort] = useState<SortDir>("desc")

  const visible = applyFilters(bookings, monthKey, sort)
  const visibleCompleted = visible.filter((b) => b.status.toLowerCase() !== "cancelled")

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <CalendarDays className="size-4 text-muted-foreground" />
          Bookings ({bookings.length})
        </p>
        {bookings.length > 0 && (
          <BookingFilterBar
            bookings={bookings}
            monthKey={monthKey}
            sort={sort}
            onMonthChange={setMonthKey}
            onSortChange={setSort}
          />
        )}
      </div>

      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings yet.</p>
      ) : visible.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">No bookings match the selected filter.</p>
      ) : (
        <>
          {monthKey && (
            <p className="text-xs text-muted-foreground">
              Showing {visibleCompleted.length} completed · {formatMoney(visibleCompleted.length * payPerSession)} pay owed this period
            </p>
          )}
          <ul className="flex flex-col gap-1.5">
            {visible.map((b) => {
              const isCancelled = b.status.toLowerCase() === "cancelled"
              const statusVariant =
                b.status.toLowerCase() === "confirmed"
                  ? "default"
                  : isCancelled
                    ? "destructive"
                    : "secondary"
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{b.dancerName || b.clientEmail || "Client"}</span>
                    {b.dancerName && b.clientEmail && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{b.clientEmail}</span>
                    )}
                    <span className="ml-2 text-muted-foreground">
                      {b.date}{b.time ? ` · ${b.time}` : ""}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!isCancelled && (
                      <span className="text-xs font-medium text-green-600">
                        {formatMoney(payPerSession)}
                      </span>
                    )}
                    <Badge variant={statusVariant} className="capitalize">
                      {b.status}
                    </Badge>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

function StatTile({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-primary/30 bg-primary/5" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
