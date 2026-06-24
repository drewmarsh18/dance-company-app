"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createBooking } from "@/app/actions/booking"
import { slotsForDate, type DayAvailability } from "@/lib/availability"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Check, Loader2, Ticket } from "lucide-react"

type DayOption = {
  iso: string
  weekday: string
  day: number
  month: string
}

// Builds the next `count` days that fall on an enabled availability weekday.
function buildAvailableDays(
  count: number,
  week: DayAvailability[],
): DayOption[] {
  const enabledDays = new Set(
    week.filter((w) => w.enabled).map((w) => w.dayOfWeek),
  )
  const days: DayOption[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < count; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    if (!enabledDays.has(d.getDay())) continue
    days.push({
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      day: d.getDate(),
      month: d.toLocaleDateString("en-US", { month: "short" }),
    })
  }
  return days
}

export function BookingFlow({
  prepMasterId,
  prepMasterName,
  week,
  bookedSlots,
  credits,
}: {
  prepMasterId: string
  prepMasterName: string
  week: DayAvailability[]
  bookedSlots: Record<string, string[]>
  credits: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Look ahead ~6 weeks so enabled weekdays yield plenty of options.
  const days = useMemo(() => buildAvailableDays(42, week), [week])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [notes, setNotes] = useState("")

  // Slots for the chosen date, with already-booked times removed.
  const timeSlots = useMemo(() => {
    if (!selectedDate) return []
    const taken = new Set(bookedSlots[selectedDate] ?? [])
    return slotsForDate(selectedDate, week).map((slot) => ({
      slot,
      taken: taken.has(slot),
    }))
  }, [selectedDate, week, bookedSlots])

  const canSubmit = selectedDate && selectedTime && !isPending

  function handleSelectDate(iso: string) {
    setSelectedDate(iso)
    setSelectedTime(null)
  }

  function handleConfirm() {
    if (!selectedDate || !selectedTime) return
    startTransition(async () => {
      const result = await createBooking({
        prepMasterId,
        prepMasterName,
        date: selectedDate,
        time: selectedTime,
        notes,
      })
      if (result.ok) {
        toast.success("Session booked!", {
          description: `Your request with ${prepMasterName} has been sent. 1 credit used.`,
        })
        router.push("/dashboard")
        router.refresh()
      } else if (result.error === "NO_CREDITS") {
        toast.error("Out of credits", {
          description: "Purchase a package to book more sessions.",
        })
        router.push("/dashboard/packages")
      } else {
        toast.error("Couldn't book session", { description: result.error })
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 rounded-lg bg-accent/40 px-4 py-2.5 text-sm">
        <Ticket className="size-4 text-primary" />
        <span>
          You have <span className="font-semibold">{credits}</span>{" "}
          {credits === 1 ? "credit" : "credits"}. This booking uses 1.
        </span>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <StepBadge n={1} done={!!selectedDate} />
          <h2 className="font-heading text-lg font-bold tracking-tight">
            Pick a date
          </h2>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {days.map((d) => {
            const active = selectedDate === d.iso
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => handleSelectDate(d.iso)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg border py-3 transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:border-primary/50",
                )}
                aria-pressed={active}
              >
                <span className="text-xs font-medium opacity-80">
                  {d.weekday}
                </span>
                <span className="font-heading text-lg font-bold leading-none">
                  {d.day}
                </span>
                <span className="text-xs opacity-80">{d.month}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <StepBadge n={2} done={!!selectedTime} />
          <h2 className="font-heading text-lg font-bold tracking-tight">
            Pick a time
          </h2>
        </div>
        {!selectedDate ? (
          <p className="text-sm text-muted-foreground">
            Select a date to see open times.
          </p>
        ) : timeSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open times on this day. Try another date.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {timeSlots.map(({ slot, taken }) => {
              const active = selectedTime === slot
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={taken}
                  onClick={() => setSelectedTime(slot)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card hover:border-primary/50",
                  )}
                  aria-pressed={active}
                >
                  {slot}
                  {taken ? (
                    <Badge variant="secondary" className="px-1 text-[10px]">
                      Booked
                    </Badge>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <StepBadge n={3} done={false} />
          <h2 className="font-heading text-lg font-bold tracking-tight">
            Anything we should know?
          </h2>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes" className="sr-only">
            Session notes
          </Label>
          <Textarea
            id="notes"
            placeholder="Goals for the session, focus areas, choreography you're working on…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
      </section>

      <Card className="sticky bottom-4">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {selectedDate && selectedTime ? (
              <p className="font-medium">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}{" "}
                · {selectedTime}
              </p>
            ) : (
              <p className="text-muted-foreground">
                Select a date and time to continue.
              </p>
            )}
            <p className="text-muted-foreground">with {prepMasterName}</p>
          </div>
          <Button
            size="lg"
            disabled={!canSubmit}
            onClick={handleConfirm}
            className="sm:w-auto"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Confirm booking
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={cn(
        "grid size-6 place-items-center rounded-full text-xs font-bold",
        done
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground",
      )}
      aria-hidden="true"
    >
      {done ? <Check className="size-3.5" /> : n}
    </span>
  )
}
