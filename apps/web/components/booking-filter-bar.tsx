"use client"

import type { AdminBooking } from "@/lib/airtable"
import { ArrowUpDown } from "lucide-react"

export type SortDir = "desc" | "asc"

/** Derives sorted unique month keys ("YYYY-MM") that appear in the booking list. */
export function monthsFromBookings(bookings: AdminBooking[]): string[] {
  const set = new Set<string>()
  for (const b of bookings) {
    if (b.date?.length >= 7) set.add(b.date.slice(0, 7))
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a))
}

export function monthLabel(key: string) {
  const [year, month] = key.split("-")
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

/** Applies the selected month filter and sort to a booking list. */
export function applyFilters(
  bookings: AdminBooking[],
  monthKey: string,
  sort: SortDir,
): AdminBooking[] {
  let result = monthKey
    ? bookings.filter((b) => b.date?.startsWith(monthKey))
    : bookings
  result = [...result].sort((a, b) =>
    sort === "desc"
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date),
  )
  return result
}

type Props = {
  bookings: AdminBooking[]
  monthKey: string
  sort: SortDir
  onMonthChange: (v: string) => void
  onSortChange: (v: SortDir) => void
}

export function BookingFilterBar({ bookings, monthKey, sort, onMonthChange, onSortChange }: Props) {
  const months = monthsFromBookings(bookings)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={monthKey}
        onChange={(e) => onMonthChange(e.target.value)}
        className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">All months</option>
        {months.map((m) => (
          <option key={m} value={m}>{monthLabel(m)}</option>
        ))}
      </select>

      <button
        onClick={() => onSortChange(sort === "desc" ? "asc" : "desc")}
        className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm hover:bg-muted transition-colors"
      >
        <ArrowUpDown className="size-3" />
        {sort === "desc" ? "Newest first" : "Oldest first"}
      </button>
    </div>
  )
}
