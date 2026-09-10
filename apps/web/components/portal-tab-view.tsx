"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import type { PrepMasterBooking } from "@/lib/airtable"
import { AppointmentCard } from "@/components/appointment-card"
import { PreviousSessionsPanel } from "@/components/previous-sessions-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ChevronLeft, ChevronRight, CalendarDays, List, X } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type CalEvent = {
  id: string; title: string; start: string | null; end: string | null
  allDay: boolean; location: string | null
}
type ViewMode = "month" | "week" | "day"

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DAY_ABBR = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
const DAY_LETTER = ["S","M","T","W","T","F","S"]
const START_HOUR = 7
const END_HOUR = 22
const HOUR_HEIGHT = 60 // px per hour
const TIME_COL_W = 52  // px

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}

function buildMonthCells(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
  return Array.from({ length: totalCells }, (_, i) => new Date(year, month, i - firstDay + 1))
}

function buildWeekDates(isoDate: string): Date[] {
  const d = new Date(`${isoDate}T00:00:00`)
  const sun = new Date(d); sun.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(sun); x.setDate(sun.getDate() + i); return x })
}

function parseBookingHM(time: string): { hour: number; minute: number } | null {
  if (!time) return null
  const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return null
  let h = parseInt(m[1], 10); const min = parseInt(m[2], 10); const mer = m[3].toUpperCase()
  if (mer === "PM" && h !== 12) h += 12
  if (mer === "AM" && h === 12) h = 0
  return { hour: h, minute: min }
}

function parseEventHM(iso: string): { hour: number; minute: number } {
  const d = new Date(iso); return { hour: d.getHours(), minute: d.getMinutes() }
}

function fmtHour(h: number): string {
  if (h === 12) return "12 PM"; if (h === 0) return "12 AM"
  return h > 12 ? `${h-12} PM` : `${h} AM`
}

function fmtEventTime(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

// ─── Day Timeline ─────────────────────────────────────────────────────────────

function DayTimeline({
  dateIso, bookings, calEvents, todayIso,
  onBookingClick,
}: {
  dateIso: string
  bookings: PrepMasterBooking[]
  calEvents: CalEvent[]
  todayIso: string
  onBookingClick: (b: PrepMasterBooking) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isToday = dateIso === todayIso
  const now = new Date()

  useEffect(() => {
    const target = isToday ? Math.max(0, (now.getHours() - 1 - START_HOUR) * HOUR_HEIGHT) : (8 - START_HOUR) * HOUR_HEIGHT
    scrollRef.current?.scrollTo({ top: target, behavior: "instant" })
  }, [dateIso])

  const totalH = (END_HOUR - START_HOUR) * HOUR_HEIGHT
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  const blocks = useMemo(() => {
    type Block = { key: string; top: number; height: number; label: string; sub: string | null; isCDP: boolean; booking?: PrepMasterBooking }
    const res: Block[] = []
    for (const b of bookings) {
      if (b.date !== dateIso) continue
      const hm = parseBookingHM(b.time)
      if (!hm) continue
      const top = (hm.hour - START_HOUR + hm.minute / 60) * HOUR_HEIGHT
      res.push({ key: `b-${b.id}`, top, height: HOUR_HEIGHT, label: b.dancerName || "Member", sub: b.time, isCDP: true, booking: b })
    }
    for (const e of calEvents) {
      if (!e.start || e.allDay) continue
      const startDate = toIso(new Date(e.start))
      if (startDate !== dateIso) continue
      const hm = parseEventHM(e.start)
      const top = (hm.hour - START_HOUR + hm.minute / 60) * HOUR_HEIGHT
      let height = HOUR_HEIGHT
      if (e.end) {
        const ehm = parseEventHM(e.end)
        height = Math.max(24, (ehm.hour - hm.hour + (ehm.minute - hm.minute) / 60) * HOUR_HEIGHT)
      }
      res.push({ key: `e-${e.id}`, top, height, label: e.title, sub: fmtEventTime(e.start), isCDP: false })
    }
    return res
  }, [bookings, calEvents, dateIso])

  const currentTop = isToday ? (now.getHours() - START_HOUR + now.getMinutes() / 60) * HOUR_HEIGHT : null

  return (
    <div ref={scrollRef} className="overflow-y-auto" style={{ height: 480 }}>
      <div style={{ display: "flex", paddingBottom: 24 }}>
        {/* Time labels */}
        <div style={{ width: TIME_COL_W, flexShrink: 0 }}>
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT, paddingTop: 2 }}>
              <span className="text-[11px] text-muted-foreground">{fmtHour(h)}</span>
            </div>
          ))}
        </div>
        {/* Event area */}
        <div className="relative flex-1 border-l border-border" style={{ height: totalH }}>
          {hours.map((h, i) => (
            <div key={h} className="absolute left-0 right-0 border-t border-border/50" style={{ top: i * HOUR_HEIGHT }} />
          ))}
          {currentTop !== null && currentTop >= 0 && currentTop <= totalH && (
            <div className="absolute left-0 right-0 z-10 flex items-center" style={{ top: currentTop }}>
              <div className="size-2 rounded-full bg-primary -ml-1" />
              <div className="flex-1 border-t-2 border-primary" />
            </div>
          )}
          {blocks.map((block) => (
            <div
              key={block.key}
              onClick={() => block.booking && onBookingClick(block.booking)}
              className={cn(
                "absolute left-1 right-1 rounded overflow-hidden border-l-[3px] px-1.5 py-1",
                block.isCDP
                  ? "bg-primary/10 border-primary cursor-pointer hover:bg-primary/20"
                  : "bg-muted/50 border-muted-foreground/40"
              )}
              style={{ top: block.top + 1, height: Math.max(22, block.height - 2) }}
            >
              <p className={cn("text-[11px] font-semibold leading-tight truncate", block.isCDP ? "text-primary" : "text-foreground")}>
                {block.label}
              </p>
              {block.height > 32 && block.sub && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{block.sub}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Day Event List (simple list view for week mode below the strip) ──────────

function DayEventList({
  dateIso, bookings, calEvents, todayIso, onBookingClick,
}: {
  dateIso: string; bookings: PrepMasterBooking[]; calEvents: CalEvent[]
  todayIso: string; onBookingClick: (b: PrepMasterBooking) => void
}) {
  const dayBookings = bookings.filter((b) => b.date === dateIso)
  const dayEvents = calEvents.filter((e) => {
    if (!e.start) return false
    return (e.start.length === 10 ? e.start : toIso(new Date(e.start))) === dateIso
  })
  const hasAny = dayBookings.length > 0 || dayEvents.length > 0
  const label = new Date(`${dateIso}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  return (
    <div className="flex flex-col gap-3">
      <p className={cn("text-xs font-bold uppercase tracking-wider", dateIso === todayIso ? "text-primary" : "text-muted-foreground")}>
        {label}
      </p>
      {!hasAny && <p className="text-sm text-muted-foreground py-1">No sessions or events</p>}
      {dayBookings.map((b) => {
        const s = b.status.toLowerCase()
        return (
          <button key={b.id} onClick={() => onBookingClick(b)} className="text-left w-full rounded-lg border border-primary/30 border-l-[4px] border-l-primary bg-primary/5 p-3 hover:bg-primary/10 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{b.dancerName || "Member"}</span>
              <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full capitalize",
                s === "confirmed" ? "bg-primary/10 text-primary" :
                s === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-muted text-muted-foreground"
              )}>{b.status}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{b.time}</p>
          </button>
        )
      })}
      {dayEvents.map((e) => (
        <div key={e.id} className="rounded-lg border border-border border-l-[4px] border-l-muted-foreground/40 bg-muted/30 p-3">
          <p className="text-sm font-semibold">{e.title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {e.allDay ? "All day" : `${fmtEventTime(e.start)}${e.end ? ` – ${fmtEventTime(e.end)}` : ""}`}
          </p>
          {e.location && <p className="text-xs text-muted-foreground mt-0.5">{e.location}</p>}
        </div>
      ))}
    </div>
  )
}

// ─── Week Strip ───────────────────────────────────────────────────────────────

function WeekStrip({
  weekDates, selectedDate, todayIso, bookingsByDate, eventsByDate, onSelect,
}: {
  weekDates: Date[]; selectedDate: string; todayIso: string
  bookingsByDate: Record<string, PrepMasterBooking[]>; eventsByDate: Record<string, CalEvent[]>
  onSelect: (iso: string) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-px mb-4">
      {weekDates.map((d) => {
        const iso = toIso(d)
        const isSelected = iso === selectedDate
        const isToday = iso === todayIso
        const hasBooking = (bookingsByDate[iso]?.length ?? 0) > 0
        const hasEvent = (eventsByDate[iso]?.length ?? 0) > 0
        return (
          <button key={iso} onClick={() => onSelect(iso)}
            className={cn("flex flex-col items-center gap-1 py-2 rounded-lg transition-colors",
              isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}>
            <span className={cn("text-[11px] font-semibold", isSelected ? "text-primary-foreground/70" : isToday ? "text-primary" : "text-muted-foreground")}>
              {DAY_ABBR[d.getDay()]}
            </span>
            <span className={cn("text-base font-bold", isSelected ? "text-primary-foreground" : isToday ? "text-primary" : "")}>
              {d.getDate()}
            </span>
            <div className="flex gap-0.5">
              {hasBooking && <div className={cn("size-1.5 rounded-full", isSelected ? "bg-primary-foreground" : "bg-primary")} />}
              {hasEvent && <div className={cn("size-1.5 rounded-full", isSelected ? "bg-primary-foreground/60" : "bg-muted-foreground")} />}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({
  viewMonth, selectedDate, todayIso, bookingsByDate, eventsByDate,
  onSelectDay,
}: {
  viewMonth: Date; selectedDate: string; todayIso: string
  bookingsByDate: Record<string, PrepMasterBooking[]>; eventsByDate: Record<string, CalEvent[]>
  onSelectDay: (iso: string) => void
}) {
  const cells = buildMonthCells(viewMonth.getFullYear(), viewMonth.getMonth())
  const curMonth = viewMonth.getMonth()

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_LETTER.map((l, i) => (
          <div key={i} className="text-center text-[11px] font-semibold text-muted-foreground py-1">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((d, i) => {
          const iso = toIso(d)
          const isCurrentMonth = d.getMonth() === curMonth
          const isSelected = iso === selectedDate
          const isToday = iso === todayIso
          const hasBooking = (bookingsByDate[iso]?.length ?? 0) > 0
          const hasEvent = (eventsByDate[iso]?.length ?? 0) > 0

          return (
            <button key={i} onClick={() => onSelectDay(iso)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 rounded transition-colors min-h-[48px]",
                isSelected ? "bg-primary text-primary-foreground" : isToday ? "ring-1 ring-primary" : "hover:bg-muted",
                !isCurrentMonth && "opacity-30"
              )}>
              <span className={cn("text-sm font-medium", isToday && !isSelected ? "text-primary font-bold" : "")}>{d.getDate()}</span>
              <div className="flex gap-0.5">
                {hasBooking && <div className={cn("size-1.5 rounded-full", isSelected ? "bg-primary-foreground" : "bg-primary")} />}
                {hasEvent && <div className={cn("size-1.5 rounded-full", isSelected ? "bg-primary-foreground/60" : "bg-muted-foreground/60")} />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PortalTabView({
  upcoming, completed, cancelled, declined, pendingCount, calendarConnected,
}: {
  upcoming: PrepMasterBooking[]
  completed: PrepMasterBooking[]
  cancelled: PrepMasterBooking[]
  declined: PrepMasterBooking[]
  pendingCount: number
  calendarConnected: boolean
}) {
  const todayIso = toIso(new Date())
  const [tab, setTab] = useState<"list" | "calendar">("list")
  const [view, setView] = useState<ViewMode>("month")
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [calEvents, setCalEvents] = useState<CalEvent[]>([])
  const [calLoading, setCalLoading] = useState(false)
  const [sheetBooking, setSheetBooking] = useState<PrepMasterBooking | null>(null)

  // All bookings for calendar dot indicators (include past/cancelled)
  const allBookings = [...upcoming, ...completed, ...cancelled, ...declined]

  useEffect(() => {
    if (tab !== "calendar" || !calendarConnected) return
    setCalLoading(true)
    const rangeStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)
    const rangeEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 2, 1)
    fetch(`/api/portal/calendar-events?timeMin=${rangeStart.toISOString()}&timeMax=${rangeEnd.toISOString()}`)
      .then((r) => r.json())
      .then((d) => { if (d.events) setCalEvents(d.events) })
      .catch(() => {})
      .finally(() => setCalLoading(false))
  }, [tab, calendarConnected, viewMonth])

  const bookingsByDate = useMemo(() => {
    const map: Record<string, PrepMasterBooking[]> = {}
    for (const b of allBookings) {
      if (!b.date) continue
      if (!map[b.date]) map[b.date] = []
      map[b.date].push(b)
    }
    return map
  }, [allBookings])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    for (const e of calEvents) {
      if (!e.start) continue
      const iso = e.start.length === 10 ? e.start : toIso(new Date(e.start))
      if (!map[iso]) map[iso] = []
      map[iso].push(e)
    }
    return map
  }, [calEvents])

  const weekDates = useMemo(() => buildWeekDates(selectedDate), [selectedDate])

  function prevPeriod() {
    if (view === "month") {
      setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
    } else if (view === "week") {
      const d = new Date(`${selectedDate}T00:00:00`); d.setDate(d.getDate() - 7); setSelectedDate(toIso(d))
    } else {
      const d = new Date(`${selectedDate}T00:00:00`); d.setDate(d.getDate() - 1); setSelectedDate(toIso(d))
    }
  }

  function nextPeriod() {
    if (view === "month") {
      setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
    } else if (view === "week") {
      const d = new Date(`${selectedDate}T00:00:00`); d.setDate(d.getDate() + 7); setSelectedDate(toIso(d))
    } else {
      const d = new Date(`${selectedDate}T00:00:00`); d.setDate(d.getDate() + 1); setSelectedDate(toIso(d))
    }
  }

  const navLabel = useMemo(() => {
    if (view === "month") return `${MONTH_NAMES[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`
    if (view === "week") {
      const start = weekDates[0]; const end = weekDates[6]
      if (start.getMonth() === end.getMonth())
        return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
      return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`
    }
    return new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  }, [view, viewMonth, selectedDate, weekDates])

  function handleSelectDay(iso: string) {
    setSelectedDate(iso)
    setView("day")
  }

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center gap-1 self-start rounded-lg border border-border bg-muted p-1">
        <button
          onClick={() => setTab("list")}
          className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}>
          <List className="size-4" /> List
        </button>
        <button
          onClick={() => setTab("calendar")}
          className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "calendar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}>
          <CalendarDays className="size-4" /> Calendar
        </button>
      </div>

      {/* ── List tab ── */}
      {tab === "list" && (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-semibold">Upcoming sessions</h2>
              {pendingCount > 0 && (
                <Badge variant="destructive" className="rounded-full">{pendingCount} pending</Badge>
              )}
            </div>
            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">No upcoming sessions booked yet.</CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {upcoming.map((b) => <AppointmentCard key={b.id} booking={b} />)}
              </div>
            )}
          </section>
          <PreviousSessionsPanel completed={completed} cancelled={cancelled} declined={declined} />
        </>
      )}

      {/* ── Calendar tab ── */}
      {tab === "calendar" && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            {/* View mode + navigation */}
            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
              {/* View mode pills */}
              <div className="flex rounded-md border border-border overflow-hidden text-sm">
                {(["month","week","day"] as ViewMode[]).map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    className={cn("px-3 py-1.5 font-medium capitalize transition-colors",
                      view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    )}>
                    {v}
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <button onClick={prevPeriod} className="rounded-md p-1.5 hover:bg-muted transition-colors">
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-sm font-semibold min-w-[180px] text-center">{navLabel}</span>
                <button onClick={nextPeriod} className="rounded-md p-1.5 hover:bg-muted transition-colors">
                  <ChevronRight className="size-4" />
                </button>
                <button onClick={() => { setSelectedDate(todayIso); setViewMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) }}
                  className="ml-1 text-xs font-medium px-2 py-1 rounded border border-border hover:bg-muted transition-colors">
                  Today
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary inline-block" /> CDP sessions</span>
              {calendarConnected && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground/60 inline-block" /> Google Calendar</span>}
              {!calendarConnected && <span className="italic">Connect Google Calendar to see external events</span>}
            </div>

            {/* Month view */}
            {view === "month" && (
              <MonthGrid
                viewMonth={viewMonth}
                selectedDate={selectedDate}
                todayIso={todayIso}
                bookingsByDate={bookingsByDate}
                eventsByDate={eventsByDate}
                onSelectDay={handleSelectDay}
              />
            )}

            {/* Week view */}
            {view === "week" && (
              <div>
                <WeekStrip
                  weekDates={weekDates}
                  selectedDate={selectedDate}
                  todayIso={todayIso}
                  bookingsByDate={bookingsByDate}
                  eventsByDate={eventsByDate}
                  onSelect={setSelectedDate}
                />
                <DayTimeline
                  dateIso={selectedDate}
                  bookings={allBookings}
                  calEvents={calEvents}
                  todayIso={todayIso}
                  onBookingClick={setSheetBooking}
                />
              </div>
            )}

            {/* Day view */}
            {view === "day" && (
              <div>
                <WeekStrip
                  weekDates={weekDates}
                  selectedDate={selectedDate}
                  todayIso={todayIso}
                  bookingsByDate={bookingsByDate}
                  eventsByDate={eventsByDate}
                  onSelect={setSelectedDate}
                />
                <DayTimeline
                  dateIso={selectedDate}
                  bookings={allBookings}
                  calEvents={calEvents}
                  todayIso={todayIso}
                  onBookingClick={setSheetBooking}
                />
              </div>
            )}

            {calLoading && (
              <p className="text-xs text-muted-foreground mt-3 text-center">Loading calendar events…</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Booking detail sheet */}
      <Sheet open={!!sheetBooking} onOpenChange={(open) => { if (!open) setSheetBooking(null) }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Session details</SheetTitle>
          </SheetHeader>
          {sheetBooking && (
            <div className="mt-4">
              <AppointmentCard booking={sheetBooking} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
