"use client"

import { useState } from "react"
import type { AdminMember, AdminBooking, AdminWorker } from "@/lib/airtable"
import { SINGLE_HOUR_PRICE } from "@/lib/packages"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { BookingFilterBar, applyFilters, type SortDir } from "@/components/booking-filter-bar"
import { TrendingUp, DollarSign, CalendarDays, Users, Award, Activity, ChevronDown, ChevronUp, Search } from "lucide-react"

type Props = {
  members: AdminMember[]
  bookings: AdminBooking[]
  workers: AdminWorker[]
}

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(key: string) {
  const [year, month] = key.split("-")
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

export function AdminOverviewPanel({ members, bookings, workers }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMonth, setSheetMonth] = useState(currentMonthKey())
  const [sheetSort, setSheetSort] = useState<SortDir>("desc")
  const [sheetSearch, setSheetSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const monthKey = currentMonthKey()
  const thisMonth = bookings.filter((b) => b.date?.startsWith(monthKey))
  const completed = thisMonth.filter((b) => b.status.toLowerCase() !== "cancelled")
  const cancelled = thisMonth.filter((b) => b.status.toLowerCase() === "cancelled")

  // Revenue = completed sessions × dancer-facing rate
  const revenue = completed.length * SINGLE_HOUR_PRICE

  // Pay owed = sum over each completed booking of that prep master's hourly rate
  const workerRateMap = new Map(workers.map((w) => [w.name, w.hourlyRate]))
  const payOwed = completed.reduce((sum, b) => sum + (workerRateMap.get(b.prepMasterName) ?? 0), 0)
  const margin = revenue - payOwed

  // All-time totals
  const allCompleted = bookings.filter((b) => b.status.toLowerCase() !== "cancelled")
  const allRevenue = allCompleted.length * SINGLE_HOUR_PRICE

  // Top Prep Masters this month by completed booking count
  const pmCounts = new Map<string, number>()
  for (const b of completed) {
    if (b.prepMasterName) pmCounts.set(b.prepMasterName, (pmCounts.get(b.prepMasterName) ?? 0) + 1)
  }
  const topPMs = Array.from(pmCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Active members (have at least 1 credit or have booked)
  const activeMembers = members.length
  const activePMs = workers.filter((w) => w.active).length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight">{monthLabel(monthKey)}</h2>
          <p className="text-sm text-muted-foreground">Company performance snapshot</p>
        </div>
        <Badge variant="outline" className="border-green-300 bg-green-100 text-green-700">Live</Badge>
      </div>

      {/* This month KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<CalendarDays className="size-4 text-primary" />}
          label="Bookings this month"
          value={String(thisMonth.length)}
          sub={`${completed.length} completed · ${cancelled.length} cancelled`}
          onClick={() => setSheetOpen(true)}
        />
        <KpiCard
          icon={<DollarSign className="size-4 text-green-600" />}
          label="Revenue this month"
          value={`$${revenue.toLocaleString()}`}
          sub={`$${SINGLE_HOUR_PRICE}/session × ${completed.length} sessions`}
          highlight="green"
        />
        <KpiCard
          icon={<TrendingUp className="size-4 text-primary" />}
          label="Margin this month"
          value={`$${margin.toLocaleString()}`}
          sub={`Pay owed: $${payOwed.toLocaleString()}`}
          highlight={margin >= 0 ? "green" : "red"}
        />
        <KpiCard
          icon={<Activity className="size-4 text-muted-foreground" />}
          label="All-time revenue"
          value={`$${allRevenue.toLocaleString()}`}
          sub={`${allCompleted.length} total sessions`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Prep Masters this month */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="size-4 text-primary" />
              Top Prep Masters this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPMs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed sessions yet this month.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {topPMs.map(([name, count], i) => {
                  const worker = workers.find((w) => w.name === name)
                  const pay = count * (worker?.hourlyRate ?? 0)
                  return (
                    <li key={name} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-medium">{name}</p>
                          {worker?.region && <p className="text-xs text-muted-foreground">{worker.region}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{count} session{count !== 1 ? "s" : ""}</p>
                        <p className="text-xs text-muted-foreground">${pay.toLocaleString()} pay</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Roster snapshot */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" />
              Roster snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <RosterRow label="Total members" value={activeMembers} />
            <RosterRow label="Active Prep Masters" value={activePMs} />
            <RosterRow label="Inactive Prep Masters" value={workers.filter((w) => !w.active).length} />
            <div className="mt-2 border-t pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">All-time bookings by status</p>
              <div className="flex flex-col gap-1.5">
                <RosterRow label="Completed" value={allCompleted.length} />
                <RosterRow label="Cancelled" value={bookings.filter((b) => b.status.toLowerCase() === "cancelled").length} />
                <RosterRow label="Pending" value={bookings.filter((b) => b.status.toLowerCase() === "pending").length} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings sheet */}
      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) setSheetSearch("") }}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col overflow-hidden">
          <SheetHeader className="mb-3 shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              Bookings
            </SheetTitle>
          </SheetHeader>
          <div className="shrink-0 mb-3 flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search member or Prep Master…"
                value={sheetSearch}
                onChange={(e) => setSheetSearch(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <BookingFilterBar
              bookings={bookings}
              monthKey={sheetMonth}
              sort={sheetSort}
              onMonthChange={setSheetMonth}
              onSortChange={setSheetSort}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {(() => {
              const q = sheetSearch.trim().toLowerCase()
              const filtered = applyFilters(bookings, sheetMonth, sheetSort).filter((b) =>
                !q ||
                (b.dancerName || b.clientEmail || "").toLowerCase().includes(q) ||
                (b.prepMasterName || "").toLowerCase().includes(q)
              )
              if (filtered.length === 0) {
                return <p className="text-sm text-muted-foreground">No bookings for this period.</p>
              }
              return (
                <ul className="flex flex-col gap-1.5">
                  {filtered.map((b) => {
                    const isCancelled = b.status.toLowerCase() === "cancelled"
                    const isExpanded = expandedId === b.id
                    return (
                      <li key={b.id} className="rounded-md border text-sm overflow-hidden">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : b.id)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{b.dancerName || b.clientEmail || "Client"}</p>
                            <p className="text-xs text-muted-foreground">{b.prepMasterName}{b.date ? ` · ${b.date}` : ""}{b.time ? ` · ${b.time}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant={b.status.toLowerCase() === "confirmed" ? "default" : isCancelled ? "destructive" : "secondary"}
                              className="capitalize"
                            >
                              {b.status}
                            </Badge>
                            {isExpanded ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t bg-muted/30 px-3 py-2.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                            <p className="text-sm">{b.notes?.trim() || <span className="text-muted-foreground italic">No notes for this booking.</span>}</p>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )
            })()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function KpiCard({
  icon, label, value, sub, highlight, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  highlight?: "green" | "red"
  onClick?: () => void
}) {
  const baseClass = highlight === "green" ? "border-green-500/30" : highlight === "red" ? "border-red-500/30" : ""
  const inner = (
    <>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`font-heading text-2xl font-bold ${highlight === "green" ? "text-green-700" : highlight === "red" ? "text-red-600" : ""}`}>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </>
  )

  if (onClick) {
    return (
      <button onClick={onClick} className={`text-left w-full rounded-xl transition-shadow hover:shadow-md hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
        <Card className={`${baseClass} pointer-events-none`}>{inner}</Card>
      </button>
    )
  }

  return <Card className={baseClass}>{inner}</Card>
}

function RosterRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
