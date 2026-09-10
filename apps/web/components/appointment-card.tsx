"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { confirmBooking, declineBooking, adjustBooking, cancelBookingAsPrepMaster, getAvailableSlotsForDate } from "@/app/actions/portal"
import type { PrepMasterBooking } from "@/lib/airtable"
import { SESSION_TYPE_LABELS, type SessionType } from "@/lib/session-types"
import { generateHourlySlots } from "@/lib/availability"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { CalendarDays, Clock, Mail, Phone, StickyNote, Check, X, Pencil, Tag } from "lucide-react"

const COMPANY_TZ_LABEL = "ET"

// Generate all hourly time slots from 7am to 11pm for the edit panel
const ALL_TIME_SLOTS = generateHourlySlots("07:00", "23:00")

// Generate next 90 days for date select
function buildDateOptions() {
  const days: { iso: string; label: string }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 90; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    days.push({ iso, label })
  }
  return days
}
const DATE_OPTIONS = buildDateOptions()

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits[0] === "1") return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return raw
}

function formatDate(date: string) {
  if (!date) return "Date TBD"
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  })
}

export function AppointmentCard({ booking }: { booking: PrepMasterBooking }) {
  const [status, setStatus] = useState(booking.status)
  const [localDate, setLocalDate] = useState(booking.date)
  const [localTime, setLocalTime] = useState(booking.time)
  const [localNotes, setLocalNotes] = useState(booking.notes)
  const [editDate, setEditDate] = useState(booking.date)
  const [editTime, setEditTime] = useState(booking.time)
  const [editNotes, setEditNotes] = useState(booking.notes)
  const [mode, setMode] = useState<"idle" | "edit" | "confirm-decline" | "confirm-decline-reschedule" | "confirm-cancel">("idle")
  const [declineReason, setDeclineReason] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [isPending, startTransition] = useTransition()
  const [availableSlots, setAvailableSlots] = useState<string[] | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  const fetchSlots = useCallback(async (date: string) => {
    if (!date) { setAvailableSlots(null); return }
    setSlotsLoading(true)
    try {
      const slots = await getAvailableSlotsForDate(date, booking.id)
      setAvailableSlots(slots.length > 0 ? slots : null)
    } catch {
      setAvailableSlots(null)
    } finally {
      setSlotsLoading(false)
    }
  }, [booking.id])

  useEffect(() => {
    if (mode === "edit") fetchSlots(editDate)
    else setAvailableSlots(null)
  }, [mode, editDate, fetchSlots])

  const isPendingStatus = status.toLowerCase() === "pending"
  const isConfirmed = status.toLowerCase() === "confirmed"
  const isCancelled = status.toLowerCase().startsWith("cancelled")
  const isPastConfirmed = isConfirmed && localDate ? new Date(`${localDate}T23:59:59`) < new Date() : false
  const displayStatus = isPastConfirmed ? "Completed" : status

  const statusVariant =
    isPastConfirmed ? "secondary"
    : isConfirmed ? "default"
    : isCancelled ? "destructive"
    : "secondary"

  const sessionTypeLabel = booking.sessionType
    ? (SESSION_TYPE_LABELS[booking.sessionType as SessionType] ?? booking.sessionType)
    : null

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmBooking(booking.id)
      if (result.ok) { setStatus("Confirmed"); toast.success("Session confirmed.") }
      else toast.error(result.error)
    })
  }

  function handleDecline(rescheduleAction?: "revert" | "cancel") {
    if (!declineReason.trim()) { toast.error("Please enter a reason before declining."); return }
    startTransition(async () => {
      const result = await declineBooking(booking.id, declineReason.trim(), rescheduleAction)
      if (result.ok) {
        if ("rescheduleReverted" in result && result.rescheduleReverted) {
          setStatus("Confirmed")
          toast.success("Reschedule denied. Booking reverted to original time.")
        } else {
          setStatus("Declined")
          toast.success("Session declined.")
        }
        setMode("idle")
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleCancel() {
    if (!cancelReason.trim()) { toast.error("Please enter a reason before cancelling."); return }
    startTransition(async () => {
      const result = await cancelBookingAsPrepMaster(booking.id, cancelReason.trim())
      if (result.ok) {
        setStatus("Cancelled")
        setMode("idle")
        toast.success(result.creditRefunded
          ? "Session cancelled. The member's credit has been refunded."
          : "Session cancelled.")
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleSaveEdit() {
    startTransition(async () => {
      const result = await adjustBooking(booking.id, {
        date: editDate,
        time: editTime,
        notes: editNotes,
      })
      if (result.ok) {
        setLocalDate(editDate)
        setLocalTime(editTime)
        setLocalNotes(editNotes)
        setMode("idle")
        toast.success("Booking updated.")
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleCancelEdit() {
    setEditDate(localDate)
    setEditTime(localTime)
    setEditNotes(localNotes)
    setMode("idle")
  }

  return (
    <Card className={isPendingStatus ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="flex flex-col gap-4 p-5">
        {/* Header row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5 font-medium">
                <CalendarDays className="size-4 text-primary" />
                {formatDate(localDate)}
              </span>
              {localTime && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-4" />
                  {localTime} <span className="text-xs">({COMPANY_TZ_LABEL})</span>
                </span>
              )}
              <Badge variant={statusVariant} className="capitalize">{displayStatus}</Badge>
              {sessionTypeLabel && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Tag className="size-3" />{sessionTypeLabel}
                </Badge>
              )}
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{booking.dancerName || "Dancer"}</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                {booking.dancerEmail && (
                  <a href={`mailto:${booking.dancerEmail}`} className="flex items-center gap-1.5 hover:text-foreground">
                    <Mail className="size-3.5" />{booking.dancerEmail}
                  </a>
                )}
                {booking.dancerPhone && (
                  <a href={`tel:${booking.dancerPhone}`} className="flex items-center gap-1.5 hover:text-foreground">
                    <Phone className="size-3.5" />{formatPhone(booking.dancerPhone)}
                  </a>
                )}
              </div>
            </div>

            {localNotes && mode === "idle" && (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <StickyNote className="mt-0.5 size-3.5 shrink-0" />{localNotes}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 flex-wrap gap-2">
            {isPendingStatus && (
              <>
                <Button size="sm" disabled={isPending} onClick={handleConfirm}>
                  <Check className="mr-1.5 size-4" />Confirm
                </Button>
                <Button size="sm" variant="outline" disabled={isPending}
                  onClick={() => { setDeclineReason(""); setMode(booking.isReschedulePending ? "confirm-decline-reschedule" : "confirm-decline") }}
                  className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10">
                  <X className="mr-1.5 size-4" />Decline
                </Button>
              </>
            )}
            {isConfirmed && !isPastConfirmed && mode === "idle" && (
              <Button size="sm" variant="outline" disabled={isPending}
                onClick={() => { setCancelReason(""); setMode("confirm-cancel") }}
                className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10">
                <X className="mr-1.5 size-4" />Cancel session
              </Button>
            )}
            {!isCancelled && mode === "idle" && (
              <Button size="sm" variant="ghost" onClick={() => setMode("edit")}>
                <Pencil className="mr-1.5 size-4" />Edit
              </Button>
            )}
          </div>
        </div>

        {/* Reschedule denial dialog — choose revert or cancel entirely */}
        {mode === "confirm-decline-reschedule" && (
          <>
            <Separator />
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-destructive">Decline this reschedule request?</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`decline-reschedule-reason-${booking.id}`}>Reason for declining</Label>
                <Textarea
                  id={`decline-reschedule-reason-${booking.id}`}
                  placeholder="e.g. Already booked at that time…"
                  rows={2}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">What should happen to the original booking?</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="sm" variant="outline" disabled={isPending || !declineReason.trim()}
                  onClick={() => handleDecline("revert")}
                  className="flex-1 border-primary/40 text-primary hover:bg-primary/10">
                  {isPending ? "Saving…" : "Keep original booking"}
                </Button>
                <Button size="sm" variant="destructive" disabled={isPending || !declineReason.trim()}
                  onClick={() => handleDecline("cancel")}
                  className="flex-1">
                  {isPending ? "Saving…" : "Cancel booking entirely"}
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>Go back</Button>
            </div>
          </>
        )}

        {/* Decline reason panel */}
        {mode === "confirm-decline" && (
          <>
            <Separator />
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-destructive">Decline this booking?</p>
              <p className="text-xs text-muted-foreground">The member's credit will be refunded. Please provide a reason so they can rebook.</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`decline-reason-${booking.id}`}>Reason</Label>
                <Textarea
                  id={`decline-reason-${booking.id}`}
                  placeholder="e.g. Schedule conflict, please rebook for next week…"
                  rows={3}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" disabled={isPending || !declineReason.trim()} onClick={handleDecline}>
                  {isPending ? "Declining…" : "Confirm decline"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>Keep booking</Button>
              </div>
            </div>
          </>
        )}

        {/* Cancel panel (PM-initiated, confirmed session) */}
        {mode === "confirm-cancel" && (
          <>
            <Separator />
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-destructive">Cancel this confirmed session?</p>
              <p className="text-xs text-muted-foreground">
                If the session is within 24 hours, the member's credit will be automatically refunded since you are cancelling.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`cancel-reason-${booking.id}`}>Reason</Label>
                <Textarea
                  id={`cancel-reason-${booking.id}`}
                  placeholder="e.g. Unavailable due to illness, please rebook…"
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" disabled={isPending || !cancelReason.trim()} onClick={handleCancel}>
                  {isPending ? "Cancelling…" : "Confirm cancellation"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>Keep session</Button>
              </div>
            </div>
          </>
        )}

        {/* Edit panel */}
        {mode === "edit" && (
          <>
            <Separator />
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium">Edit booking</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`date-${booking.id}`}>Date</Label>
                  <select
                    id={`date-${booking.id}`}
                    value={editDate}
                    onChange={(e) => { setEditDate(e.target.value); setEditTime(""); fetchSlots(e.target.value) }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select date…</option>
                    {DATE_OPTIONS.map((d) => (
                      <option key={d.iso} value={d.iso}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`time-${booking.id}`}>Time (ET)</Label>
                  <select
                    id={`time-${booking.id}`}
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    disabled={slotsLoading}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">{slotsLoading ? "Loading…" : "Select time…"}</option>
                    {(availableSlots ?? ALL_TIME_SLOTS).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`notes-${booking.id}`}>Notes</Label>
                <Textarea
                  id={`notes-${booking.id}`}
                  placeholder="Session notes…"
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={isPending} onClick={handleSaveEdit}>
                  {isPending ? "Saving…" : "Save changes"}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
