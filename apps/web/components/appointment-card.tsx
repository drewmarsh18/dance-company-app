"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { confirmBooking, declineBooking, adjustBooking } from "@/app/actions/portal"
import type { PrepMasterBooking } from "@/lib/airtable"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { CalendarDays, Clock, Mail, Phone, StickyNote, Check, X, Pencil } from "lucide-react"

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
  const [mode, setMode] = useState<"idle" | "edit">("idle")
  const [isPending, startTransition] = useTransition()

  const isPendingStatus = status.toLowerCase() === "pending"
  const isCancelled = status.toLowerCase() === "cancelled"
  const statusVariant =
    status.toLowerCase() === "confirmed" ? "default"
    : isCancelled ? "destructive"
    : "secondary"

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmBooking(booking.id)
      if (result.ok) { setStatus("Confirmed"); toast.success("Session confirmed.") }
      else toast.error(result.error)
    })
  }

  function handleDecline() {
    startTransition(async () => {
      const result = await declineBooking(booking.id)
      if (result.ok) { setStatus("Cancelled"); toast.success("Session declined.") }
      else toast.error(result.error)
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
                  {localTime}
                </span>
              )}
              <Badge variant={statusVariant} className="capitalize">{status}</Badge>
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
                    <Phone className="size-3.5" />{booking.dancerPhone}
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
                <Button size="sm" variant="outline" disabled={isPending} onClick={handleDecline}
                  className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10">
                  <X className="mr-1.5 size-4" />Decline
                </Button>
              </>
            )}
            {!isCancelled && mode === "idle" && (
              <Button size="sm" variant="ghost" onClick={() => setMode("edit")}>
                <Pencil className="mr-1.5 size-4" />Edit
              </Button>
            )}
          </div>
        </div>

        {/* Edit panel */}
        {mode === "edit" && (
          <>
            <Separator />
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium">Edit booking</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`date-${booking.id}`}>Date</Label>
                  <Input
                    id={`date-${booking.id}`}
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`time-${booking.id}`}>Time</Label>
                  <Input
                    id={`time-${booking.id}`}
                    type="text"
                    placeholder="e.g. 3:00 PM"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                  />
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
