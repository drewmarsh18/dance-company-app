"use client"

import { useState, useCallback } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PrepMaster, PrepMasterBooking } from "@/lib/airtable"

type TeamEntry = { pm: PrepMaster; bookings: PrepMasterBooking[] }

type Props = {
  initialTeam: TeamEntry[]
  initialYear: number
  initialMonth: number
  isAdmin: boolean
  allRDs: string[]
  initialRdName: string
}

const MONTHS = [
  "January","February","March","April","May",
  "June","July","August","September","October","November","December",
]

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
  completed: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
  canceled:  "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400",
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  completed: "Completed",
  canceled:  "Canceled",
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

function formatDate(dateStr: string) {
  if (!dateStr) return { day: "—", mon: "" }
  const d = new Date(`${dateStr}T00:00:00`)
  return {
    day: String(d.getDate()).padStart(2, "0"),
    mon: MONTHS[d.getMonth()].slice(0, 3),
  }
}

export function MyPrepMastersView({ initialTeam, initialYear, initialMonth, isAdmin, allRDs, initialRdName }: Props) {
  const [team, setTeam] = useState<TeamEntry[]>(initialTeam)
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [loading, setLoading] = useState(false)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [selectedRD, setSelectedRD] = useState(initialRdName)

  const fetchTeam = useCallback(async (y: number, m: number, rdName: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ year: String(y), month: String(m) })
      if (isAdmin && rdName) params.set("rdName", rdName)
      const res = await fetch(`/api/portal/my-prep-masters?${params}`)
      const data = await res.json()
      setTeam(data.team ?? [])
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  const changeMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1)  { m = 12; y-- }
    setMonth(m)
    setYear(y)
    setOpenIds(new Set())
    fetchTeam(y, m, selectedRD)
  }

  const changeRD = (rdName: string) => {
    setSelectedRD(rdName)
    setOpenIds(new Set())
    fetchTeam(year, month, rdName)
  }

  const togglePM = (name: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const stats = team.reduce(
    (acc, { bookings }) => {
      for (const b of bookings) {
        acc.total++
        if (b.status === "confirmed") acc.confirmed++
        else if (b.status === "completed") acc.completed++
        else if (b.status === "canceled") acc.canceled++
      }
      return acc
    },
    { total: 0, confirmed: 0, completed: 0, canceled: 0 },
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">My PrepMasters</h1>
        <p className="mt-1 text-muted-foreground">
          {team.length} PrepMaster{team.length !== 1 ? "s" : ""} on your team
        </p>
      </div>

      {/* Admin RD selector */}
      {isAdmin && allRDs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Regional Director
          </label>
          <select
            value={selectedRD}
            onChange={(e) => changeRD(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 max-w-xs"
          >
            {allRDs.map((rd) => (
              <option key={rd} value={rd}>{rd}</option>
            ))}
          </select>
        </div>
      )}

      {/* Month nav + stats */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{MONTHS[month - 1]} {year}</span>
          <div className="flex gap-1">
            <button
              onClick={() => changeMonth(-1)}
              className="rounded-md border p-1.5 hover:bg-muted transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => changeMonth(1)}
              className="rounded-md border p-1.5 hover:bg-muted transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 divide-x divide-border">
          {[
            { label: "Total",     value: stats.total,     cls: "" },
            { label: "Confirmed", value: stats.confirmed, cls: "text-emerald-600 dark:text-emerald-400" },
            { label: "Completed", value: stats.completed, cls: "text-blue-600 dark:text-blue-400" },
            { label: "Canceled",  value: stats.canceled,  cls: "text-red-600 dark:text-red-400" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="flex flex-col items-center py-1">
              <span className={cn("text-2xl font-bold tabular-nums", cls)}>
                {loading ? "—" : value}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* PrepMaster list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Loading…
        </div>
      ) : team.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Users className="size-10 opacity-30" />
          <p className="text-sm">No PrepMasters found for this month.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {team.map(({ pm, bookings }) => {
            const isOpen = openIds.has(pm.name)
            const counts = bookings.reduce(
              (a, b) => { a[b.status] = (a[b.status] ?? 0) + 1; return a },
              {} as Record<string, number>,
            )

            return (
              <div
                key={pm.name}
                className={cn(
                  "rounded-xl border bg-card overflow-hidden transition-colors",
                  isOpen && "border-primary/60",
                )}
              >
                <button
                  onClick={() => togglePM(pm.name)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="size-9 shrink-0 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center">
                    {initials(pm.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{pm.name}</p>
                    <p className="text-xs text-muted-foreground">{pm.university || "—"}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {counts.confirmed > 0 && (
                      <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold px-2 py-0.5">
                        {counts.confirmed} confirmed
                      </span>
                    )}
                    {counts.completed > 0 && (
                      <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[11px] font-semibold px-2 py-0.5">
                        {counts.completed} completed
                      </span>
                    )}
                    {counts.canceled > 0 && (
                      <span className="rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-[11px] font-semibold px-2 py-0.5">
                        {counts.canceled} canceled
                      </span>
                    )}
                    {bookings.length === 0 && (
                      <span className="text-xs text-muted-foreground">No bookings</span>
                    )}
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="border-t">
                    {bookings.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground italic">
                        No bookings this month.
                      </p>
                    ) : (
                      bookings.map((bk) => {
                        const { day, mon } = formatDate(bk.date)
                        return (
                          <div
                            key={bk.id}
                            className="flex items-center gap-3 px-4 py-3 border-b last:border-0"
                          >
                            <div className="w-8 shrink-0 text-center">
                              <div className="text-base font-bold tabular-nums leading-none">{day}</div>
                              <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{mon}</div>
                            </div>
                            <div className="w-px h-8 bg-border shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{bk.dancerName || "Member"}</p>
                              <p className="text-xs text-muted-foreground">{bk.time}</p>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 rounded-full text-[11px] font-semibold px-2.5 py-0.5",
                                STATUS_STYLES[bk.status] ?? "",
                              )}
                            >
                              {STATUS_LABELS[bk.status] ?? bk.status}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
