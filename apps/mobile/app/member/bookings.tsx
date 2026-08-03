import { useEffect, useState, useCallback, useMemo } from "react"
import {
  View, Text, FlatList, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Plus, ChevronRight, List, CalendarDays } from "lucide-react-native"
import { authClient } from "@/lib/auth-client"
import { SPACING, RADIUS } from "@/constants/theme"
import { useColors } from "@/lib/theme-context"
import { BookingDetailModal, formatDate, formatTime, type Booking } from "@/components/BookingDetailModal"

const API_BASE = "https://dance-company-app.vercel.app"

type CalEvent = { id: string; title: string; start: string | null; end: string | null; allDay: boolean; location: string | null }

function toIso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }

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

function CalendarView({ events, refreshing, onRefresh }: { events: CalEvent[]; refreshing: boolean; onRefresh: () => void }) {
  const COLORS = useColors()
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const [selectedDate, setSelectedDate] = useState(toIso(today))

  // Build 6-week date strip starting from today's week Sunday
  const weekStart = useMemo(() => {
    const d = new Date(today); d.setDate(d.getDate() - d.getDay()); return d
  }, [today])
  const dates = useMemo(() => Array.from({ length: 42 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  }), [weekStart])

  // Map ISO date → events on that day
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

  const selectedEvents = eventsByDate[selectedDate] ?? []

  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  function formatEventTime(iso: string | null): string {
    if (!iso || iso.length === 10) return "All day"
    const d = new Date(iso)
    let h = d.getHours(); const m = d.getMinutes()
    const period = h >= 12 ? "PM" : "AM"
    if (h === 0) h = 12; else if (h > 12) h -= 12
    return `${h}:${String(m).padStart(2, "0")} ${period}`
  }

  // Show which month is visible
  const visibleMonth = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`)
    return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`
  }, [selectedDate])

  return (
    <ScrollView
      contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Month label */}
      <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: SPACING.sm }}>{visibleMonth}</Text>

      {/* Day-of-week headers */}
      <View style={{ flexDirection: "row", marginBottom: 4 }}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase" }}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", borderRadius: RADIUS.md, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border }}>
        {dates.map((d, i) => {
          const iso = toIso(d)
          const isToday = iso === toIso(today)
          const isSelected = iso === selectedDate
          const isPast = d < today
          const hasEvents = (eventsByDate[iso]?.length ?? 0) > 0
          const isCurrentMonth = d.getMonth() === new Date(`${selectedDate}T00:00:00`).getMonth()
          return (
            <TouchableOpacity
              key={iso}
              style={{
                width: "14.28%",
                aspectRatio: 1,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isSelected ? COLORS.primary : isToday ? COLORS.primaryLight : COLORS.surface,
                borderRightWidth: (i + 1) % 7 === 0 ? 0 : 1,
                borderBottomWidth: i >= 35 ? 0 : 1,
                borderColor: COLORS.border,
              }}
              onPress={() => setSelectedDate(iso)}
              activeOpacity={0.7}
            >
              <Text style={{
                fontSize: 13, fontWeight: isToday || isSelected ? "700" : "400",
                color: isSelected ? "#fff" : isToday ? COLORS.primary : isPast || !isCurrentMonth ? COLORS.textMuted : COLORS.text,
              }}>{d.getDate()}</Text>
              {hasEvents && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? "rgba(255,255,255,0.8)" : COLORS.primary, marginTop: 1 }} />}
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Events for selected date */}
      <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>
          {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </Text>
        {selectedEvents.length === 0 ? (
          <Text style={{ fontSize: 13, color: COLORS.textMuted, paddingVertical: SPACING.sm }}>No events</Text>
        ) : selectedEvents.map((e) => (
          <View key={e.id} style={{ flexDirection: "row", gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.primary }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>{e.title}</Text>
              <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{formatEventTime(e.start)}{e.end && !e.allDay ? ` – ${formatEventTime(e.end)}` : ""}</Text>
              {e.location ? <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{e.location}</Text> : null}
            </View>
          </View>
        ))}
      </View>
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
  }

  function handleRescheduled(id: string, date: string, time: string) {
    setUpcoming((prev) => prev.map((b) => b.id === id ? { ...b, date, time, status: "Pending" } : b))
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
          ? <CalendarView events={calEvents} refreshing={refreshing} onRefresh={onRefresh} />
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
