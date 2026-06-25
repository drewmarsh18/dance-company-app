"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createBooking } from "@/app/actions/booking"
import { slotsForDate, type DayAvailability } from "@/lib/availability"
import { planDisplayStatus } from "@/lib/plan-utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Check, Loader2, Package, Ticket } from "lucide-react"
import type { MemberPlan, CompCredit } from "@/lib/airtable"
import type { Booking } from "@/app/actions/booking"
import type { SessionType } from "@/lib/session-types"

type DayOption = {
  iso: string
  weekday: string
  day: number
  month: string
}

type CreditOption =
  | { kind: "plan"; plan: MemberPlan; sessionType: SessionType }
  | { kind: "single"; credit: CompCredit; index: number; sessionType: SessionType }

const SINGLE_SESSION_TYPE: Record<string, SessionType> = {
  "60 min": "private-60",
  "45 min": "private-45",
  "30 min": "private-30",
}

const SINGLE_LABEL_TO_TYPES: Record<string, string[]> = {
  "60 min": ["private-60", "pack-hour"],
  "45 min": ["private-45"],
  "30 min": ["private-30"],
}

function buildAvailableDays(count: number, week: DayAvailability[]): DayOption[] {
  const enabledDays = new Set(week.filter((w) => w.enabled).map((w) => w.dayOfWeek))
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
  plans,
  compCredits,
  bookings,
}: {
  prepMasterId: string
  prepMasterName: string
  week: DayAvailability[]
  bookedSlots: Record<string, string[]>
  credits: number
  plans: MemberPlan[]
  compCredits: CompCredit[]
  bookings: Booking[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const days = useMemo(() => buildAvailableDays(42, week), [week])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [selectedOption, setSelectedOption] = useState<CreditOption | null>(null)

  // Build the list of selectable credit options
  const creditOptions = useMemo<CreditOption[]>(() => {
    const opts: CreditOption[] = []

    // Active plan credits
    for (const plan of plans) {
      if (planDisplayStatus(plan) === "Active") {
        opts.push({ kind: "plan", plan, sessionType: "pack-hour" })
      }
    }

    // Unused single sessions
    compCredits.forEach((credit, index) => {
      const matchTypes = SINGLE_LABEL_TO_TYPES[credit.label] ?? []
      const used = bookings.some(
        (b) =>
          b.status.toLowerCase() !== "cancelled" &&
          b.sessionType !== null &&
          matchTypes.includes(b.sessionType) &&
          new Date(b.date) >= new Date(credit.grantedAt),
      )
      if (!used) {
        opts.push({
          kind: "single",
          credit,
          index,
          sessionType: SINGLE_SESSION_TYPE[credit.label] ?? "private-60",
        })
      }
    })

    return opts
  }, [plans, compCredits, bookings])

  // Auto-select if only one option
  const effectiveOption = selectedOption ?? (creditOptions.length === 1 ? creditOptions[0] : null)
  const showCreditStep = creditOptions.length > 1

  const timeSlots = useMemo(() => {
    if (!selectedDate) return []
    const taken = new Set(bookedSlots[selectedDate] ?? [])
    return slotsForDate(selectedDate, week).map((slot) => ({ slot, taken: taken.has(slot) }))
  }, [selectedDate, week, bookedSlots])

  const canSubmit = selectedDate && selectedTime && effectiveOption && !isPending

  function handleSelectDate(iso: string) {
    setSelectedDate(iso)
    setSelectedTime(null)
  }

  function handleConfirm() {
    if (!selectedDate || !selectedTime || !effectiveOption) return
    startTransition(async () => {
      const result = await createBooking({
        prepMasterId,
        prepMasterName,
        date: selectedDate,
        time: selectedTime,
        notes,
        sessionType: effectiveOption.sessionType,
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

  let stepOffset = showCreditStep ? 1 : 0

  return (
    <div className="flex flex-col gap-6">
      {showCreditStep && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <StepBadge n={1} done={!!effectiveOption} />
            <h2 className="font-heading text-lg font-bold tracking-tight">Choose your credit</h2>
          </div>
          <div className="flex flex-col gap-2">
            {creditOptions.map((opt, i) => {
              const active = effectiveOption === opt ||
                (effectiveOption?.kind === opt.kind &&
                  opt.kind === "plan" && effectiveOption.kind === "plan" && effectiveOption.plan.id === opt.plan.id) ||
                (effectiveOption?.kind === "single" && opt.kind === "single" && effectiveOption.index === opt.index)

              if (opt.kind === "plan") {
                const expiryDate = opt.plan.expiresAt
                  ? new Date(opt.plan.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : null
                return (
                  <button
                    key={`plan-${opt.plan.id}`}
                    type="button"
                    onClick={() => setSelectedOption(opt)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                      active ? "border-primary bg-primary/5" : "bg-card hover:border-primary/50",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Package className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                      <span>
                        <span className="font-medium">{opt.plan.planName}</span>
                        {expiryDate && (
                          <span className="ml-2 text-xs text-muted-foreground">Expires {expiryDate}</span>
                        )}
                      </span>
                    </span>
                    {active && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                )
              } else {
                const displayLabel = opt.credit.label === "60 min" ? "60-Min Single Session"
                  : opt.credit.label === "45 min" ? "45-Min Single Session"
                  : "30-Min Single Session"
                return (
                  <button
                    key={`single-${opt.index}`}
                    type="button"
                    onClick={() => setSelectedOption(opt)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                      active ? "border-primary bg-primary/5" : "bg-card hover:border-primary/50",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Ticket className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                      <span className="font-medium">{displayLabel}</span>
                    </span>
                    {active && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                )
              }
            })}
          </div>
        </section>
      )}

      {!showCreditStep && effectiveOption && (
        <div className="flex items-center gap-2 rounded-lg bg-accent/40 px-4 py-2.5 text-sm">
          {effectiveOption.kind === "plan" ? (
            <Package className="size-4 text-primary" />
          ) : (
            <Ticket className="size-4 text-primary" />
          )}
          <span>
            Using{" "}
            <span className="font-semibold">
              {effectiveOption.kind === "plan"
                ? effectiveOption.plan.planName
                : effectiveOption.credit.label === "60 min" ? "60-Min Single Session"
                : effectiveOption.credit.label === "45 min" ? "45-Min Single Session"
                : "30-Min Single Session"}
            </span>
            . This booking uses 1 credit.
          </span>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <StepBadge n={1 + stepOffset} done={!!selectedDate} />
          <h2 className="font-heading text-lg font-bold tracking-tight">Pick a date</h2>
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
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
                )}
                aria-pressed={active}
              >
                <span className="text-xs font-medium opacity-80">{d.weekday}</span>
                <span className="font-heading text-lg font-bold leading-none">{d.day}</span>
                <span className="text-xs opacity-80">{d.month}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <StepBadge n={2 + stepOffset} done={!!selectedTime} />
          <h2 className="font-heading text-lg font-bold tracking-tight">Pick a time</h2>
        </div>
        {!selectedDate ? (
          <p className="text-sm text-muted-foreground">Select a date to see open times.</p>
        ) : timeSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open times on this day. Try another date.</p>
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
                    active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
                  )}
                  aria-pressed={active}
                >
                  {slot}
                  {taken ? <Badge variant="secondary" className="px-1 text-[10px]">Booked</Badge> : null}
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <StepBadge n={3 + stepOffset} done={false} />
          <h2 className="font-heading text-lg font-bold tracking-tight">Anything we should know?</h2>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes" className="sr-only">Session notes</Label>
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
              <p className="text-muted-foreground">Select a date and time to continue.</p>
            )}
            <p className="text-muted-foreground">with {prepMasterName}</p>
          </div>
          <Button size="lg" disabled={!canSubmit} onClick={handleConfirm} className="sm:w-auto">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
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
        done ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      )}
      aria-hidden="true"
    >
      {done ? <Check className="size-3.5" /> : n}
    </span>
  )
}
