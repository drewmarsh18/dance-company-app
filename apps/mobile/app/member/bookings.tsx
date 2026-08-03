import { useEffect, useState, useCallback, useMemo } from "react"
import {
  View, Text, FlatList, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Plus, ChevronRight, List, CalendarDays, ChevronLeft } from "lucide-react-native"
import { authClient } from "@/lib/auth-client"
import { SPACING, RADIUS } from "@/constants/theme"
import { useColors } from "@/lib/theme-context"
import { BookingDetailModal, formatDate, formatTime, type Booking } from "@/components/BookingDetailModal"

const API_BASE = "https://dance-company-app.vercel.app"

type CalEvent = { id: string; title: string; start: string | null; end: string | null; allDay: boolean; location: string | null }
type CalFilter = "day" | "week" | "month"

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatEventTime(iso: string | null): string {
  if (!iso || iso.length === 10) return "All day"
  const d = new Date(iso)
  let h = d.getHours(); const m = d.getMinutes()
  const period = h >= 12 ? "PM" : "AM"
  if (h === 0) h = 12; else if (h > 12) h -= 12
  return `${h}:${String(m).padStart(2, "0")} ${period}`
}

function BookingCard({ booking, onPress }: { booking: Booking; onPress?: () => void }) {
  const COLORS = useColors()
  const s = booking.status.toLowerCase()
  const sc = s === "confirmed" ? { bg: COLORS.primaryLight, text: COLORS.primary }
    : s === "declined" ? { bg: COLORS.amberLight, text: COLORS.amber }
    : s.startsWith("cancelled") ? { bg: COLORS.redLight, text: COLORS.red }
    : { bg: COLORS.grayLight, text: COLORS.textMuted }
  const inner = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>{booking.prepMasterName || "PrepMaster"}</Text>
        <Text style={{ fontSize: 12, color: COLORS.textMuted }}>{formatDate(booking.date)}{booking.time ? ` · ${formatTime(booking.time)}` : ""}</Text>
        {booking.sessionType ? <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{booking.sessionType}</Text> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, backgroundColor: sc.bg }}>
          <Text style={{ fontSize: 11, fontWeight: "600", textTransform: "capitalize", color: sc.text }}>{booking.status}</Text>
        </View>
        {onPress && <ChevronRight size={14} color={COLORS.textMuted} />}
      </View>
    </View>
  )
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>
  return inner
}

function SectionHeader({ title, count, expanded, onToggle }: { title: string; count: number; expanded: boolean; onToggle: () => void }) {
  const COLORS = useColors()
  return (
    <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: SPACING.sm }} onPress={onToggle} activeOpacity={0.7}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {title} ({count})
      </Text>
      <ChevronRight size={16} color={COLORS.textMuted} style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }} />
    </TouchableOpacity>
  )
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function CalendarView({
  events,
  upcomingBookings,
  refreshing,
  onRefresh,
  onBookingPress,
}: {
  events: CalEvent[]
  upcomingBookings: Booking[]
  refreshing: boolean
  onRefresh: () => void
  onBookingPress: (b: Booking) => void
}) {
  const COLORS = useColors()
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const [selectedDate, setSelectedDate] = useState(toIso(today))
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [filter, setFilter] = useState<CalFilter>("month")

  // Map ISO date → calendar events
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    for (const e of events) {
      if (!e.start) continue
      const iso = e.start.length === 10 ? e.start : toIso(new Date(e.start))
      if (!map[iso]) map[iso] = []
      map[iso].push(e)
    }
    return map
  }, [events])

  // Map ISO date → upcoming bookings
  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {}
    for (const b of upcomingBookings) {
      if (!b.date) continue
      if (!map[b.date]) map[b.date] = []
      map[b.date].push(b)
    }
    return map
  }, [upcomingBookings])

  function hasActivity(iso: string) {
    return (eventsByDate[iso]?.length ?? 0) > 0 || (bookingsByDate[iso]?.length ?? 0) > 0
  }

  // Monthly grid cells (padded to full weeks)
  const monthCells = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
    return Array.from({ length: totalCells }, (_, i) => {
      const d = new Date(year, month, i - firstDay + 1)
      return d
    })
  }, [viewMonth])

  // Week dates (Sun–Sat of selected date's week)
  const weekDates = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`)
    const sun = new Date(d); sun.setDate(d.getDate() - d.getDay())
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(sun); x.setDate(sun.getDate() + i); return x })
  }, [selectedDate])

  function prevMonth() { setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)) }
  function nextMonth() { setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)) }
  function prevWeek() {
    const d = new Date(`${selectedDate}T00:00:00`); d.setDate(d.getDate() - 7)
    setSelectedDate(toIso(d))
  }
  function nextWeek() {
    const d = new Date(`${selectedDate}T00:00:00`); d.setDate(d.getDate() + 7)
    setSelectedDate(toIso(d))
  }
  function prevDay() {
    const d = new Date(`${selectedDate}T00:00:00`); d.setDate(d.getDate() - 1)
    setSelectedDate(toIso(d))
  }
  function nextDay() {
    const d = new Date(`${selectedDate}T00:00:00`); d.setDate(d.getDate() + 1)
    setSelectedDate(toIso(d))
  }

  // Navigation label
  const navLabel = useMemo(() => {
    if (filter === "month") return `${MONTH_NAMES[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`
    if (filter === "week") {
      const start = weekDates[0]; const end = weekDates[6]
      if (start.getMonth() === end.getMonth())
        return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
      return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`
    }
    const d = new Date(`${selectedDate}T00:00:00`)
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  }, [filter, viewMonth, weekDates, selectedDate])

  // Events/bookings for selected date (day filter or grid tap)
  const selectedDateEvents = eventsByDate[selectedDate] ?? []
  const selectedDateBookings = bookingsByDate[selectedDate] ?? []

  // For month filter: events grouped by day across the whole month
  const monthEventDays = useMemo(() => {
    if (filter !== "month") return []
    const year = viewMonth.getFullYear(); const month = viewMonth.getMonth()
    const days: { iso: string; bookings: Booking[]; events: CalEvent[] }[] = []
    for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      const b = bookingsByDate[iso] ?? []
      const e = eventsByDate[iso] ?? []
      if (b.length > 0 || e.length > 0) days.push({ iso, bookings: b, events: e })
    }
    return days
  }, [filter, viewMonth, bookingsByDate, eventsByDate])

  // For week filter: events grouped by day across the week
  const weekEventDays = useMemo(() => {
    if (filter !== "week") return []
    return weekDates.map((d) => {
      const iso = toIso(d)
      return { iso, date: d, bookings: bookingsByDate[iso] ?? [], events: eventsByDate[iso] ?? [] }
    })
  }, [filter, weekDates, bookingsByDate, eventsByDate])

  function EventRow({ event, booking }: { event?: CalEvent; booking?: Booking }) {
    const time = booking ? formatTime(booking.time) : formatEventTime(event?.start ?? null)
    const title = booking ? `Session w/ ${booking.prepMasterName || "PrepMaster"}` : (event?.title ?? "")
    const subtitle = booking?.sessionType ?? event?.location ?? null
    const isCDPBooking = !!booking

    const inner = (
      <View style={{
        flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
        backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
        borderWidth: 1, borderColor: isCDPBooking ? COLORS.primary : COLORS.border,
        borderLeftWidth: 3, borderLeftColor: isCDPBooking ? COLORS.primary : COLORS.textMuted,
        padding: SPACING.md,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>{title}</Text>
          <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{time}</Text>
          {subtitle ? <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{subtitle}</Text> : null}
        </View>
        {isCDPBooking && <ChevronRight size={16} color={COLORS.primary} style={{ marginTop: 2 }} />}
      </View>
    )
    if (booking) return <TouchableOpacity onPress={() => onBookingPress(booking)} activeOpacity={0.7}>{inner}</TouchableOpacity>
    return inner
  }

  function DaySection({ iso, bookings, calEvents }: { iso: string; bookings: Booking[]; calEvents: CalEvent[] }) {
    const date = new Date(`${iso}T00:00:00`)
    const isToday = iso === toIso(today)
    if (bookings.length === 0 && calEvents.length === 0) return null
    return (
      <View style={{ marginBottom: SPACING.md }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: isToday ? COLORS.primary : COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: SPACING.xs ?? 4 }}>
          {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          {isToday ? "  · Today" : ""}
        </Text>
        <View style={{ gap: SPACING.sm }}>
          {bookings.map((b) => <EventRow key={`b-${b.id}`} booking={b} />)}
          {calEvents.map((e) => <EventRow key={`e-${e.id}`} event={e} />)}
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Filter tabs */}
      <View style={{ flexDirection: "row", borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, overflow: "hidden", marginBottom: SPACING.md }}>
        {(["day", "week", "month"] as CalFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={{ flex: 1, alignItems: "center", paddingVertical: 8, backgroundColor: filter === f ? COLORS.primary : "transparent" }}
            onPress={() => setFilter(f)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: filter === f ? "#fff" : COLORS.textMuted, textTransform: "capitalize" }}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Navigation header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.sm }}>
        <TouchableOpacity
          onPress={filter === "month" ? prevMonth : filter === "week" ? prevWeek : prevDay}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.text }}>{navLabel}</Text>
        <TouchableOpacity
          onPress={filter === "month" ? nextMonth : filter === "week" ? nextWeek : nextDay}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <ChevronRight size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Calendar grid (month + week show a grid) */}
      {filter !== "day" && (
        <>
          {/* Day-of-week headers */}
          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: COLORS.textMuted }}>{d}</Text>
            ))}
          </View>

          {/* Grid */}
          {filter === "month" && (
            <View style={{ borderRadius: RADIUS.md, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md }}>
              {Array.from({ length: monthCells.length / 7 }, (_, row) => (
                <View key={row} style={{ flexDirection: "row", borderBottomWidth: row < monthCells.length / 7 - 1 ? 1 : 0, borderColor: COLORS.border }}>
                  {monthCells.slice(row * 7, row * 7 + 7).map((d, col) => {
                    const iso = toIso(d)
                    const isCurrentMonth = d.getMonth() === viewMonth.getMonth()
                    const isToday = iso === toIso(today)
                    const isSelected = iso === selectedDate
                    const activity = hasActivity(iso)
                    const hasCDPBooking = (bookingsByDate[iso]?.length ?? 0) > 0
                    return (
                      <TouchableOpacity
                        key={iso}
                        style={{
                          flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center",
                          backgroundColor: isSelected ? COLORS.primary : isToday ? COLORS.primaryLight : "transparent",
                          borderRightWidth: col < 6 ? 1 : 0, borderColor: COLORS.border,
                        }}
                        onPress={() => setSelectedDate(iso)}
                        activeOpacity={0.7}
                      >
                        <Text style={{
                          fontSize: 13, fontWeight: isToday || isSelected ? "700" : "400",
                          color: isSelected ? "#fff" : !isCurrentMonth ? COLORS.border : isToday ? COLORS.primary : COLORS.text,
                        }}>{d.getDate()}</Text>
                        {activity && (
                          <View style={{ flexDirection: "row", gap: 2, marginTop: 1 }}>
                            {hasCDPBooking && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? "rgba(255,255,255,0.9)" : COLORS.primary }} />}
                            {(eventsByDate[iso]?.length ?? 0) > 0 && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : COLORS.textMuted }} />}
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </View>
          )}

          {filter === "week" && (
            <View style={{ borderRadius: RADIUS.md, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md }}>
              <View style={{ flexDirection: "row" }}>
                {weekDates.map((d, col) => {
                  const iso = toIso(d)
                  const isToday = iso === toIso(today)
                  const isSelected = iso === selectedDate
                  const activity = hasActivity(iso)
                  const hasCDPBooking = (bookingsByDate[iso]?.length ?? 0) > 0
                  return (
                    <TouchableOpacity
                      key={iso}
                      style={{
                        flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center",
                        backgroundColor: isSelected ? COLORS.primary : isToday ? COLORS.primaryLight : "transparent",
                        borderRightWidth: col < 6 ? 1 : 0, borderColor: COLORS.border,
                      }}
                      onPress={() => setSelectedDate(iso)}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        fontSize: 13, fontWeight: isToday || isSelected ? "700" : "400",
                        color: isSelected ? "#fff" : isToday ? COLORS.primary : COLORS.text,
                      }}>{d.getDate()}</Text>
                      {activity && (
                        <View style={{ flexDirection: "row", gap: 2, marginTop: 1 }}>
                          {hasCDPBooking && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? "rgba(255,255,255,0.9)" : COLORS.primary }} />}
                          {(eventsByDate[iso]?.length ?? 0) > 0 && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : COLORS.textMuted }} />}
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          )}
        </>
      )}

      {/* Legend */}
      <View style={{ flexDirection: "row", gap: SPACING.md, marginBottom: SPACING.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary }} />
          <Text style={{ fontSize: 11, color: COLORS.textMuted }}>CDP session</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.textMuted }} />
          <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Calendar event</Text>
        </View>
      </View>

      {/* Events section */}
      {filter === "day" && (
        <DaySection iso={selectedDate} bookings={selectedDateBookings} calEvents={selectedDateEvents} />
      )}

      {filter === "week" && (
        weekEventDays.every((d) => d.bookings.length === 0 && d.events.length === 0)
          ? <Text style={{ fontSize: 13, color: COLORS.textMuted, paddingVertical: SPACING.sm }}>No events this week</Text>
          : weekEventDays.map(({ iso, bookings, events: evs }) => (
            <DaySection key={iso} iso={iso} bookings={bookings} calEvents={evs} />
          ))
      )}

      {filter === "month" && (
        monthEventDays.length === 0
          ? <Text style={{ fontSize: 13, color: COLORS.textMuted, paddingVertical: SPACING.sm }}>No events this month</Text>
          : monthEventDays.map(({ iso, bookings, events: evs }) => (
            <DaySection key={iso} iso={iso} bookings={bookings} calEvents={evs} />
          ))
      )}
    </ScrollView>
  )
}

function ConnectCalendarPrompt({ onGoToProfile }: { onGoToProfile: () => void }) {
  const COLORS = useColors()
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: SPACING.xl, gap: SPACING.md }}>
      <CalendarDays size={48} color={COLORS.textMuted} />
      <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text, textAlign: "center" }}>Connect Google Calendar</Text>
      <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center", lineHeight: 20 }}>
        Link your Google Calendar in your profile to see all your events here.
      </Text>
      <TouchableOpacity
        style={{ backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md }}
        onPress={onGoToProfile}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Go to Profile</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function MemberBookingsScreen() {
  const router = useRouter()
  const COLORS = useColors()
  const [tab, setTab] = useState<"list" | "calendar">("list")
  const [upcoming, setUpcoming] = useState<Booking[]>([])
  const [past, setPast] = useState<Booking[]>([])
  const [cancelled, setCancelled] = useState<Booking[]>([])
  const [upcomingExpanded, setUpcomingExpanded] = useState(true)
  const [pastExpanded, setPastExpanded] = useState(true)
  const [cancelledExpanded, setCancelledExpanded] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calEvents, setCalEvents] = useState<CalEvent[]>([])
  const [calConnected, setCalConnected] = useState(false)

  const load = useCallback(async () => {
    try {
      const [bookingRes, calRes] = await Promise.all([
        authClient.$fetch(`${API_BASE}/api/member/dashboard`),
        authClient.$fetch(`${API_BASE}/api/member/calendar-events`),
      ])
      if (bookingRes.error || !bookingRes.data) throw new Error((bookingRes.error as any)?.statusText ?? "Failed to load")
      const d = bookingRes.data as { upcoming: Booking[]; past: Booking[]; cancelled: Booking[] }
      setUpcoming(d.upcoming ?? [])
      setPast(d.past ?? [])
      setCancelled(d.cancelled ?? [])
      setError(null)
      if (!calRes.error && calRes.data) {
        const cal = calRes.data as { connected: boolean; events: CalEvent[] }
        setCalConnected(cal.connected)
        setCalEvents(cal.events ?? [])
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong.") }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false) }, [load])

  function handleCancelled(id: string) {
    const b = upcoming.find((x) => x.id === id)
    setUpcoming((prev) => prev.filter((x) => x.id !== id))
    if (b) setCancelled((prev) => [{ ...b, status: "Cancelled" }, ...prev])
    setSelectedBooking(null)
  }

  function handleRescheduled(id: string, date: string, time: string) {
    setUpcoming((prev) => prev.map((b) => b.id === id ? { ...b, date, time, status: "Pending" } : b))
    setSelectedBooking(null)
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    )
  }

  const isEmpty = upcoming.length === 0 && past.length === 0 && cancelled.length === 0

  type ListItem =
    | { type: "header"; title: string; count: number; expanded: boolean; onToggle: () => void }
    | { type: "item"; booking: Booking; tappable: boolean }

  const allItems: ListItem[] = []
  if (upcoming.length > 0) {
    allItems.push({ type: "header", title: "Upcoming", count: upcoming.length, expanded: upcomingExpanded, onToggle: () => setUpcomingExpanded((v) => !v) })
    if (upcomingExpanded) upcoming.forEach((b) => allItems.push({ type: "item", booking: b, tappable: true }))
  }
  if (past.length > 0) {
    allItems.push({ type: "header", title: "Past", count: past.length, expanded: pastExpanded, onToggle: () => setPastExpanded((v) => !v) })
    if (pastExpanded) past.forEach((b) => allItems.push({ type: "item", booking: b, tappable: false }))
  }
  if (cancelled.length > 0) {
    allItems.push({ type: "header", title: "Cancelled", count: cancelled.length, expanded: cancelledExpanded, onToggle: () => setCancelledExpanded((v) => !v) })
    if (cancelledExpanded) cancelled.forEach((b) => allItems.push({ type: "item", booking: b, tappable: false }))
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm }}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: COLORS.text, fontFamily: "Sora_700Bold" }}>My Bookings</Text>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full }} onPress={() => router.push("/member/book" as any)} activeOpacity={0.7}>
          <Plus size={16} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>New Booking</Text>
        </TouchableOpacity>
      </View>

      {/* Tab toggle */}
      <View style={{ flexDirection: "row", marginHorizontal: SPACING.md, marginBottom: SPACING.sm, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, overflow: "hidden" }}>
        {([["list", "List", List], ["calendar", "Calendar", CalendarDays]] as const).map(([value, label, Icon]) => (
          <TouchableOpacity
            key={value}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, backgroundColor: tab === value ? COLORS.primary : "transparent" }}
            onPress={() => setTab(value)}
            activeOpacity={0.8}
          >
            <Icon size={15} color={tab === value ? "#fff" : COLORS.textMuted} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: tab === value ? "#fff" : COLORS.textMuted }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={{ margin: SPACING.md, backgroundColor: COLORS.redLight, borderRadius: RADIUS.sm, padding: SPACING.sm }}>
          <Text style={{ fontSize: 13, color: COLORS.red }}>{error}</Text>
        </View>
      ) : tab === "calendar" ? (
        calConnected
          ? <CalendarView
              events={calEvents}
              upcomingBookings={upcoming}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onBookingPress={setSelectedBooking}
            />
          : <ConnectCalendarPrompt onGoToProfile={() => router.push("/member/profile" as any)} />
      ) : isEmpty ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: SPACING.lg, gap: SPACING.sm }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: COLORS.text }}>No bookings yet</Text>
          <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center" }}>Your sessions will appear here once booked.</Text>
        </View>
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item, i) => item.type === "item" ? item.booking.id : `header-${i}`}
          contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          renderItem={({ item }) => {
            if (item.type === "header") return <SectionHeader title={item.title} count={item.count} expanded={item.expanded} onToggle={item.onToggle} />
            return <BookingCard booking={item.booking} onPress={item.tappable ? () => setSelectedBooking(item.booking) : undefined} />
          }}
        />
      )}
      <BookingDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onCancelled={handleCancelled}
        onRescheduled={handleRescheduled}
        onRefresh={load}
      />
    </SafeAreaView>
  )
}
