"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { cancelBooking, rescheduleBooking } from "@/app/actions/booking"
import { isWithin24Hours } from "@/lib/utils"
import type { Booking } from "@/app/actions/booking"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarClock, X } from "lucide-react"
import { slotsForDate, type DayAvailability } from "@/lib/availability"

type Props = {
  booking: Booking
  availability: DayAvailability[]
}

// Builds the next 60 days that fall on an enabled availability weekday
function buildAvailableDays(week: DayAvailability[]) {
  const enabledDays = new Set(week.filter((w) => w.enabled).map((w) => w.dayOfWeek))
  const days: { iso: string; label: string }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 1; days.length < 30; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    if (!enabledDays.has(d.getDay())) continue
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    days.push({ iso, label })
  }
  return days
}

export function BookingRow({ booking, availability }: Props) {
  const date = new Date(booking.date)
  const formatted = Number.isNaN(date.getTime())
    ? booking.date
    : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

  const isCancelled = booking.status.toLowerCase() === "cancelled"
  const within24 = isWithin24Hours(booking.date, booking.time)
  const canAdjust = !isCancelled && !within24
  const canCancel = !isCancelled

  const statusVariant =
    booking.status.toLowerCase() === "confirmed"
      ? "default"
      : isCancelled
        ? "destructive"
        : "secondary"

  const [mode, setMode] = useState<"idle" | "adjust" | "confirm-cancel">("idle")
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTime, setSelectedTime] = useState("")
  const [localStatus, setLocalStatus] = useState(booking.status)
  const [localDate, setLocalDate] = useState(booking.date)
  const [localTime, setLocalTime] = useState(booking.time)
  const [isPending, startTransition] = useTransition()

  const availableDays = buildAvailableDays(availability)
  const timeSlots = selectedDate ? slotsForDate(selectedDate, availability) : []

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelBooking(booking.id)
      if (result.ok) {
        setLocalStatus("Cancelled")
        setMode("idle")
        toast.success(result.creditRefunded ? "Booking cancelled. Your credit has been refunded." : "Booking cancelled. No credit refund within 24 hours.")
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleReschedule() {
    if (!selectedDate || !selectedTime) {
      toast.error("Please select a date and time.")
      return
    }
    startTransition(async () => {
      const result = await rescheduleBooking(booking.id, selectedDate, selectedTime)
      if (result.ok) {
        setLocalDate(selectedDate)
        setLocalTime(selectedTime)
        setLocalStatus("Pending")
        setMode("idle")
        setSelectedDate("")
        setSelectedTime("")
        toast.success("Booking rescheduled.")
      } else {
        toast.error(result.error)
      }
    })
  }

  const displayDate = new Date(localDate)
  const displayFormatted = Number.isNaN(displayDate.getTime())
    ? localDate
    : displayDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        {/* Main row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 flex-col items-center justify-center rounded-lg bg-secondary text-center">
              <span className="text-xs font-medium text-muted-foreground">
                {displayFormatted.split(" ")[0]}
              </span>
              <span className="font-heading text-base font-bold leading-none">
                {displayDate.getDate() || ""}
              </span>
            </div>
            <div>
              <p className="font-medium">{booking.prepMasterName || "Prep Master"}</p>
              <p className="text-sm text-muted-foreground">
                {displayFormatted}{localTime ? ` · ${localTime}` : ""}
              </p>
              {within24 && !isCancelled && (
                <p className="text-xs text-amber-500 mt-0.5">Within 24 hours — cancel only</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={localStatus.toLowerCase() === "confirmed" ? "default" : localStatus.toLowerCase() === "cancelled" ? "destructive" : "secondary"} className="capitalize">
              {localStatus}
            </Badge>
            {canAdjust && mode === "idle" && (
              <Button size="sm" variant="outline" onClick={() => setMode("adjust")}>
                <CalendarClock className="mr-1.5 size-3.5" />
                Adjust
              </Button>
            )}
            {canCancel && mode === "idle" && (
              <Button size="sm" variant="ghost" onClick={() => setMode("confirm-cancel")}
                className="text-destructive hover:text-destructive">
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Reschedule picker */}
        {mode === "adjust" && (
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Choose a new date and time</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime("") }}
              >
                <option value="">Select date…</option>
                {availableDays.map((d) => (
                  <option key={d.iso} value={d.iso}>{d.label}</option>
                ))}
              </select>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                disabled={!selectedDate}
              >
                <option value="">Select time…</option>
                {timeSlots.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={isPending || !selectedDate || !selectedTime} onClick={handleReschedule}>
                {isPending ? "Saving…" : "Confirm reschedule"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setMode("idle"); setSelectedDate(""); setSelectedTime("") }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Cancel confirmation */}
        {mode === "confirm-cancel" && (
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium">Cancel this booking?</p>
            <p className="text-sm text-muted-foreground">
              {within24
                ? <>Your session credit will <span className="font-medium text-foreground">not</span> be refunded — this session is within 24 hours.</>
                : "Your session credit will be refunded."}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={isPending} onClick={handleCancel}>
                {isPending ? "Cancelling…" : "Yes, cancel it"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
                Keep booking
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
