import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform,
  Dimensions,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import {
  CalendarDays, Clock, Phone, StickyNote,
  Check, X, Pencil, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, List,
} from "lucide-react-native"
import { authClient, useSession } from "@/lib/auth-client"
import { formatTime } from "@/components/BookingDetailModal"
import { SPACING, RADIUS } from "@/constants/theme"
import { useColors } from "@/lib/theme-context"

const API_BASE = "https://dance-company-app.vercel.app"
const SCREEN_WIDTH = Dimensions.get("window").width
const HOUR_HEIGHT = 56
const START_HOUR = 6
const END_HOUR = 23
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR)
const TIME_LABEL_WIDTH = 52
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"]

type PrepMasterBooking = {
  id: string; date: string; time: string; status: string; notes: string; prepMasterNotes: string; declineReason: string; cancellationReason: string
  dancerName: string; dancerEmail: string; dancerPhone: string; userId: string; sessionType?: string
}

type DashData = {
  prepMaster: { id: string; name: string; email: string }
  upcoming: PrepMasterBooking[]; completed: PrepMasterBooking[]; cancelled: PrepMasterBooking[]
}

type CalEvent = { id: string; title: string; start: string | null; end: string | null; allDay: boolean; location: string | null }
type CalFilter = "day" | "month"

function formatDate(date: string) {
  if (!date) return "Date TBD"
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function parseTime(iso: string): { hour: number; minute: number } {
  const d = new Date(iso)
  return { hour: d.getHours(), minute: d.getMinutes() }
}

function formatHour(h: number) {
  if (h === 0) return "12 AM"
  if (h === 12) return "12 PM"
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function formatEventTime(iso: string | null): string {
  if (!iso || iso.length === 10) return "All day"
  const { hour, minute } = parseTime(iso)
  const period = hour >= 12 ? "PM" : "AM"
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${h}:${String(minute).padStart(2, "0")} ${period}`
}

// ─── Hourly Timeline ────────────────────────────────────────────────────────

function HourlyView({
  dateIso,
  calEvents,
  bookings,
}: {
  dateIso: string
  calEvents: CalEvent[]
  bookings: PrepMasterBooking[]
}) {
  const COLORS = useColors()
  const scrollRef = useRef<ScrollView>(null)
  const now = new Date()
  const todayIso = toIso(now)
  const isToday = dateIso === todayIso
  const totalHeight = HOURS.length * HOUR_HEIGHT

  useEffect(() => {
    const targetHour = isToday ? now.getHours() - 1 : 8
    const offset = Math.max(0, (targetHour - START_HOUR) * HOUR_HEIGHT - HOUR_HEIGHT)
    setTimeout(() => scrollRef.current?.scrollTo({ y: offset, animated: false }), 100)
  }, [dateIso])

  type EventBlock = { key: string; top: number; height: number; title: string; subtitle: string | null; isCDP: boolean; booking?: PrepMasterBooking; color: string }

  const blocks: EventBlock[] = useMemo(() => {
    const result: EventBlock[] = []
    for (const b of bookings) {
      if (!b.time) continue
      const [hStr, mStr] = b.time.replace(/(AM|PM)/i, "").trim().split(":")
      let hour = parseInt(hStr, 10); const minute = parseInt(mStr ?? "0", 10)
      if (b.time.toUpperCase().includes("PM") && hour !== 12) hour += 12
      if (b.time.toUpperCase().includes("AM") && hour === 12) hour = 0
      const top = (hour - START_HOUR + minute / 60) * HOUR_HEIGHT
      result.push({ key: `b-${b.id}`, top, height: HOUR_HEIGHT, title: `Session w/ ${b.dancerName || "Member"}`, subtitle: null, isCDP: true, booking: b, color: COLORS.primary })
    }
    for (const e of calEvents) {
      if (!e.start || e.allDay) continue
      const { hour, minute } = parseTime(e.start)
      const top = (hour - START_HOUR + minute / 60) * HOUR_HEIGHT
      let height = HOUR_HEIGHT
      if (e.end) {
        const end = parseTime(e.end)
        height = Math.max(30, (end.hour - hour + (end.minute - minute) / 60) * HOUR_HEIGHT)
      }
      result.push({ key: `e-${e.id}`, top, height, title: e.title, subtitle: e.location, isCDP: false, color: COLORS.textMuted })
    }
    return result
  }, [bookings, calEvents, COLORS])

  const currentTimeTop = isToday ? (now.getHours() - START_HOUR + now.getMinutes() / 60) * HOUR_HEIGHT : null

  return (
    <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: SPACING.md, paddingBottom: 80 }}>
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: TIME_LABEL_WIDTH }}>
            {HOURS.map((h) => (
              <View key={h} style={{ height: HOUR_HEIGHT, justifyContent: "flex-start", paddingTop: 2 }}>
                <Text style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "right", paddingRight: 8 }}>{formatHour(h)}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1, position: "relative", height: totalHeight }}>
            {HOURS.map((h, i) => (
              <View key={h} style={{ position: "absolute", top: i * HOUR_HEIGHT, left: 0, right: 0, height: 1, backgroundColor: COLORS.border }} />
            ))}
            {currentTimeTop !== null && currentTimeTop >= 0 && currentTimeTop <= totalHeight && (
              <View style={{ position: "absolute", top: currentTimeTop, left: 0, right: 0, flexDirection: "row", alignItems: "center", zIndex: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginLeft: -4 }} />
                <View style={{ flex: 1, height: 1.5, backgroundColor: COLORS.primary }} />
              </View>
            )}
            {blocks.map((block) => (
              <View key={block.key} style={{
                position: "absolute", top: block.top + 1, left: 2, right: 2,
                height: block.height - 2, borderRadius: 5,
                backgroundColor: block.isCDP ? COLORS.primaryLight : `${COLORS.textMuted}22`,
                borderLeftWidth: 3, borderLeftColor: block.color,
                padding: 4, overflow: "hidden",
              }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: block.isCDP ? COLORS.primary : COLORS.text }} numberOfLines={1}>{block.title}</Text>
                {block.height > 36 && block.subtitle ? <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 1 }} numberOfLines={1}>{block.subtitle}</Text> : null}
                {block.height > 36 ? <Text style={{ fontSize: 10, color: block.isCDP ? COLORS.primary : COLORS.textMuted, marginTop: 1 }}>
                  {block.isCDP && block.booking ? formatTime(block.booking.time) : formatEventTime(calEvents.find(e => `e-${e.id}` === block.key)?.start ?? null)}
                </Text> : null}
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

// ─── Calendar View ───────────────────────────────────────────────────────────

function CalendarView({
  events,
  bookings,
  refreshing,
  onRefresh,
}: {
  events: CalEvent[]
  bookings: PrepMasterBooking[]
  refreshing: boolean
  onRefresh: () => void
}) {
  const COLORS = useColors()
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const todayIso = toIso(today)
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [filter, setFilter] = useState<CalFilter>("month")

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

  const bookingsByDate = useMemo(() => {
    const map: Record<string, PrepMasterBooking[]> = {}
    for (const b of bookings) {
      if (!b.date) continue
      if (!map[b.date]) map[b.date] = []
      map[b.date].push(b)
    }
    return map
  }, [bookings])

  function hasActivity(iso: string) {
    return (eventsByDate[iso]?.length ?? 0) > 0 || (bookingsByDate[iso]?.length ?? 0) > 0
  }

  const monthCells = useMemo(() => {
    const year = viewMonth.getFullYear(); const month = viewMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
    return Array.from({ length: totalCells }, (_, i) => new Date(year, month, i - firstDay + 1))
  }, [viewMonth])

  const weekDates = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`)
    const sun = new Date(d); sun.setDate(d.getDate() - d.getDay())
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(sun); x.setDate(sun.getDate() + i); return x })
  }, [selectedDate])

  function prevPeriod() {
    if (filter === "month") setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
    else { const d = new Date(`${selectedDate}T00:00:00`); d.setDate(d.getDate() - 1); setSelectedDate(toIso(d)) }
  }
  function nextPeriod() {
    if (filter === "month") setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
    else { const d = new Date(`${selectedDate}T00:00:00`); d.setDate(d.getDate() + 1); setSelectedDate(toIso(d)) }
  }

  function setFilterMode(f: CalFilter) {
    setSelectedDate(todayIso)
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setFilter(f)
  }

  const navLabel = useMemo(() => {
    if (filter === "month") return `${MONTH_NAMES[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`
    const d = new Date(`${selectedDate}T00:00:00`)
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  }, [filter, viewMonth, selectedDate])

  const selectedEvents = eventsByDate[selectedDate] ?? []
  const selectedBookings = bookingsByDate[selectedDate] ?? []

  function WeekStrip() {
    return (
      <View style={{ flexDirection: "row", paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm }}>
        {weekDates.map((d) => {
          const iso = toIso(d)
          const isSelected = iso === selectedDate
          const isToday = iso === todayIso
          const activity = hasActivity(iso)
          return (
            <TouchableOpacity key={iso} style={{ flex: 1, alignItems: "center", gap: 4 }} onPress={() => setSelectedDate(iso)} activeOpacity={0.7}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: isToday ? COLORS.primary : COLORS.textMuted }}>
                {["S","M","T","W","T","F","S"][d.getDay()]}
              </Text>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: isSelected ? COLORS.primary : "transparent" }}>
                <Text style={{ fontSize: 15, fontWeight: isToday || isSelected ? "700" : "400", color: isSelected ? "#fff" : isToday ? COLORS.primary : COLORS.text }}>
                  {d.getDate()}
                </Text>
              </View>
              {activity && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? COLORS.primary : COLORS.textMuted }} />}
            </TouchableOpacity>
          )
        })}
      </View>
    )
  }

  function SelectedDayEvents() {
    const dateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    const hasAny = selectedEvents.length > 0 || selectedBookings.length > 0
    return (
      <View style={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.md, gap: SPACING.sm }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: selectedDate === todayIso ? COLORS.primary : COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {dateLabel}
        </Text>
        {!hasAny && <Text style={{ fontSize: 13, color: COLORS.textMuted, paddingVertical: 4 }}>No sessions</Text>}
        {selectedBookings.map((b) => {
          const s = b.status.toLowerCase()
          const sc = s === "confirmed" ? { bg: COLORS.primaryLight, text: COLORS.primary }
            : s === "declined" ? { bg: COLORS.amberLight, text: COLORS.amber }
            : s.startsWith("cancelled") ? { bg: COLORS.redLight, text: COLORS.red }
            : { bg: COLORS.grayLight, text: COLORS.textMuted }
          return (
            <View key={b.id} style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, borderLeftWidth: 4, borderLeftColor: COLORS.primary, padding: SPACING.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, flex: 1, marginRight: SPACING.sm }}>{b.dancerName || "Member"}</Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, backgroundColor: sc.bg }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", textTransform: "capitalize", color: sc.text }}>{b.status}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{formatTime(b.time)}</Text>
            </View>
          )
        })}
        {selectedEvents.map((e) => (
          <View key={e.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, borderLeftColor: COLORS.textMuted, padding: SPACING.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>{e.title}</Text>
              <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{formatEventTime(e.start)}{e.end && !e.allDay ? ` – ${formatEventTime(e.end)}` : ""}</Text>
              {e.location ? <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{e.location}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Filter tabs */}
      <View style={{ flexDirection: "row", alignSelf: "center", marginBottom: SPACING.sm, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, overflow: "hidden" }}>
        {(["day", "month"] as CalFilter[]).map((f) => (
          <TouchableOpacity key={f} style={{ alignItems: "center", paddingVertical: 5, paddingHorizontal: SPACING.lg, backgroundColor: filter === f ? COLORS.primary : "transparent" }} onPress={() => setFilterMode(f)} activeOpacity={0.8}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: filter === f ? "#fff" : COLORS.textMuted, textTransform: "capitalize" }}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Nav header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, marginBottom: SPACING.sm }}>
        <TouchableOpacity onPress={prevPeriod} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
          <ChevronLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setSelectedDate(todayIso); setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1)) }} activeOpacity={0.7}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.text }}>{navLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={nextPeriod} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
          <ChevronRight size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {filter === "day" && <WeekStrip />}

      {filter === "month" && (
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
          <View style={{ flexDirection: "row", paddingHorizontal: SPACING.md, marginBottom: 4 }}>
            {DAY_LABELS.map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: COLORS.textMuted }}>{d}</Text>
            ))}
          </View>
          <View style={{ marginHorizontal: SPACING.md, borderRadius: RADIUS.md, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm }}>
            {Array.from({ length: monthCells.length / 7 }, (_, row) => (
              <View key={row} style={{ flexDirection: "row", borderBottomWidth: row < monthCells.length / 7 - 1 ? 1 : 0, borderColor: COLORS.border }}>
                {monthCells.slice(row * 7, row * 7 + 7).map((d, col) => {
                  const iso = toIso(d)
                  const inMonth = d.getMonth() === viewMonth.getMonth()
                  const isToday = iso === todayIso
                  const isSelected = iso === selectedDate
                  const hasCDP = (bookingsByDate[iso]?.length ?? 0) > 0
                  const hasCal = (eventsByDate[iso]?.length ?? 0) > 0
                  return (
                    <TouchableOpacity
                      key={iso}
                      style={{ flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", backgroundColor: isSelected ? COLORS.primary : "transparent", borderRightWidth: col < 6 ? 1 : 0, borderColor: COLORS.border }}
                      onPress={() => setSelectedDate(iso)}
                      activeOpacity={0.7}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: isSelected ? COLORS.primary : isToday ? COLORS.primaryLight : "transparent" }}>
                        <Text style={{ fontSize: 14, fontWeight: isToday || isSelected ? "700" : "400", color: isSelected ? "#fff" : !inMonth ? COLORS.border : isToday ? COLORS.primary : COLORS.text }}>
                          {d.getDate()}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 2, height: 5, marginTop: 1 }}>
                        {hasCDP && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? "rgba(255,255,255,0.9)" : COLORS.primary }} />}
                        {hasCal && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : COLORS.textMuted }} />}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))}
          </View>
          <SelectedDayEvents />
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {filter === "day" && (
        <HourlyView dateIso={selectedDate} calEvents={selectedEvents} bookings={selectedBookings} />
      )}
    </View>
  )
}

// ─── Booking Card (List view) ────────────────────────────────────────────────

function BookingCard({ booking, dimmed, onUpdate }: {
  booking: PrepMasterBooking; dimmed?: boolean; onUpdate: (id: string, patch: Partial<PrepMasterBooking>) => void
}) {
  const COLORS = useColors()
  const styles = makeStyles(COLORS)
  const [status, setStatus] = useState(booking.status)
  const [localDate, setLocalDate] = useState(booking.date)
  const [localTime, setLocalTime] = useState(booking.time)
  const [localPrepMasterNotes, setLocalPrepMasterNotes] = useState(booking.prepMasterNotes)
  const [editDate, setEditDate] = useState(booking.date)
  const [editTime, setEditTime] = useState(booking.time)
  const [editPrepMasterNotes, setEditPrepMasterNotes] = useState(booking.prepMasterNotes)
  const [mode, setMode] = useState<"idle" | "edit" | "decline-reason">("idle")
  const [declineReason, setDeclineReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const isPending = status.toLowerCase() === "pending"
  const isCancelled = status.toLowerCase().startsWith("cancelled") || status.toLowerCase() === "declined"
  const s = status.toLowerCase()
  const sc = s === "confirmed" ? { bg: COLORS.primaryLight, text: COLORS.primary }
    : s === "declined" ? { bg: COLORS.amberLight, text: COLORS.amber }
    : s.startsWith("cancelled") ? { bg: COLORS.redLight, text: COLORS.red }
    : s === "pending" ? { bg: COLORS.amberLight, text: COLORS.amber }
    : { bg: COLORS.grayLight, text: COLORS.textMuted }

  async function callAction(action: "confirm" | "decline" | "edit", reason?: string) {
    setSaving(true)
    try {
      const body: Record<string, unknown> = action === "edit"
        ? { date: editDate, time: editTime, prepMasterNotes: editPrepMasterNotes }
        : action === "decline"
        ? { action, declineReason: reason }
        : { action }
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/portal/bookings/${booking.id}`,
        { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } })
      if (error) throw new Error((error as any)?.message ?? "Failed")
      const res = data as { ok: boolean; error?: string }
      if (!res.ok) throw new Error(res.error ?? "Failed")
      if (action === "confirm") { setStatus("Confirmed"); onUpdate(booking.id, { status: "Confirmed" }) }
      if (action === "decline") { setStatus("Declined"); onUpdate(booking.id, { status: "Declined" }); setMode("idle") }
      if (action === "edit") {
        setLocalDate(editDate); setLocalTime(editTime); setLocalPrepMasterNotes(editPrepMasterNotes)
        onUpdate(booking.id, { date: editDate, time: editTime, prepMasterNotes: editPrepMasterNotes })
        setMode("idle")
      }
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong.") }
    finally { setSaving(false) }
  }

  return (
    <View style={[styles.card, isPending && styles.cardPending, dimmed && { opacity: 0.7 }]}>
      <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.cardDateRow}>
            <CalendarDays size={14} color={COLORS.primary} />
            <Text style={styles.cardDate}>{formatDate(localDate)}</Text>
            {localTime ? <><Clock size={13} color={COLORS.textMuted} /><Text style={styles.cardTime}>{formatTime(localTime)}</Text></> : null}
          </View>
          <Text style={styles.cardDancer}>{booking.dancerName || "Dancer"}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}><Text style={[styles.badgeText, { color: sc.text }]}>{status}</Text></View>
          {expanded ? <ChevronUp size={16} color={COLORS.textMuted} /> : <ChevronDown size={16} color={COLORS.textMuted} />}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.cardBody}>
          {booking.dancerPhone ? (
            <View style={styles.infoRow}><Phone size={13} color={COLORS.textMuted} /><Text style={styles.infoText}>{booking.dancerPhone}</Text></View>
          ) : null}
          {booking.notes ? <View style={styles.infoRow}><StickyNote size={13} color={COLORS.textMuted} /><Text style={[styles.infoText, { fontStyle: "italic" }]}><Text style={{ fontWeight: "600" }}>Member: </Text>{booking.notes}</Text></View> : null}
          {localPrepMasterNotes && mode === "idle" ? <View style={styles.infoRow}><StickyNote size={13} color={COLORS.primary} /><Text style={styles.infoText}><Text style={{ fontWeight: "600", color: COLORS.primary }}>Your notes: </Text>{localPrepMasterNotes}</Text></View> : null}
          {booking.declineReason && mode === "idle" ? <View style={styles.infoRow}><StickyNote size={13} color={COLORS.amber} /><Text style={styles.infoText}><Text style={{ fontWeight: "600", color: COLORS.amber }}>Decline reason: </Text>{booking.declineReason}</Text></View> : null}
          {booking.cancellationReason && mode === "idle" ? <View style={styles.infoRow}><StickyNote size={13} color={COLORS.red} /><Text style={styles.infoText}><Text style={{ fontWeight: "600", color: COLORS.red }}>Cancellation reason: </Text>{booking.cancellationReason}</Text></View> : null}

          {mode === "idle" && !isCancelled && (
            <View style={styles.actionRow}>
              {isPending && (
                <>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary, saving && { opacity: 0.5 }]} onPress={() => callAction("confirm")} disabled={saving} activeOpacity={0.8}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <><Check size={14} color="#fff" /><Text style={styles.actionBtnPrimaryText}>Confirm</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger, saving && { opacity: 0.5 }]}
                    onPress={() => { setDeclineReason(""); setMode("decline-reason") }}
                    disabled={saving} activeOpacity={0.8}>
                    <X size={14} color={COLORS.red} /><Text style={styles.actionBtnDangerText}>Decline</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGhost]} onPress={() => setMode("edit")} activeOpacity={0.8}>
                <Pencil size={14} color={COLORS.textMuted} /><Text style={styles.actionBtnGhostText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === "decline-reason" && (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={styles.editPanel}>
                <Text style={styles.editPanelTitle}>Reason for declining</Text>
                <TextInput
                  style={[styles.editInput, { minHeight: 72, textAlignVertical: "top" }]}
                  value={declineReason}
                  onChangeText={setDeclineReason}
                  placeholder="e.g. Scheduling conflict, unavailable that day…"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  autoFocus
                />
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDanger, saving && { opacity: 0.5 }]}
                    onPress={() => {
                      if (!declineReason.trim()) { Alert.alert("Required", "Please enter a reason for declining."); return }
                      callAction("decline", declineReason.trim())
                    }}
                    disabled={saving} activeOpacity={0.8}>
                    {saving ? <ActivityIndicator size="small" color={COLORS.red} /> : <><X size={14} color={COLORS.red} /><Text style={styles.actionBtnDangerText}>Confirm decline</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGhost]} onPress={() => setMode("idle")} activeOpacity={0.8}>
                    <Text style={styles.actionBtnGhostText}>Go back</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}

          {mode === "edit" && (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={styles.editPanel}>
                <Text style={styles.editPanelTitle}>Edit booking</Text>
                <View style={styles.editRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editLabel}>Date</Text>
                    <TextInput style={styles.editInput} value={editDate} onChangeText={setEditDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editLabel}>Time</Text>
                    <TextInput style={styles.editInput} value={editTime} onChangeText={setEditTime} placeholder="e.g. 3:00 PM" placeholderTextColor={COLORS.textMuted} />
                  </View>
                </View>
                <Text style={styles.editLabel}>Your notes</Text>
                <TextInput style={[styles.editInput, { minHeight: 64, textAlignVertical: "top" }]} value={editPrepMasterNotes} onChangeText={setEditPrepMasterNotes} placeholder="Notes visible to the member…" placeholderTextColor={COLORS.textMuted} multiline />
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary, saving && { opacity: 0.5 }]} onPress={() => callAction("edit")} disabled={saving} activeOpacity={0.8}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionBtnPrimaryText}>Save changes</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGhost]} onPress={() => { setEditDate(localDate); setEditTime(localTime); setEditPrepMasterNotes(localPrepMasterNotes); setMode("idle") }} activeOpacity={0.8}>
                    <Text style={styles.actionBtnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      )}
    </View>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function PortalDashboard() {
  const { data: session } = useSession()
  const COLORS = useColors()
  const firstName = session?.user?.name?.split(" ")[0] ?? "there"
  const [tab, setTab] = useState<"list" | "calendar">("list")
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calEvents, setCalEvents] = useState<CalEvent[]>([])
  const [calConnected, setCalConnected] = useState(false)

  const load = useCallback(async () => {
    try {
      const [dashRes, calRes] = await Promise.all([
        authClient.$fetch(`${API_BASE}/api/portal/dashboard`),
        authClient.$fetch(`${API_BASE}/api/portal/calendar-events`),
      ])
      if (dashRes.error || !dashRes.data) throw new Error((dashRes.error as any)?.statusText ?? "Failed to load")
      setData(dashRes.data as DashData); setError(null)
      if (!calRes.error && calRes.data) {
        const cal = calRes.data as { connected: boolean; events: CalEvent[] }
        setCalConnected(cal.connected)
        setCalEvents(cal.events ?? [])
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong.") }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false) }, [load])

  function handleUpdate(id: string, patch: Partial<PrepMasterBooking>) {
    setData((prev) => {
      if (!prev) return prev
      const patchList = (list: PrepMasterBooking[]) => list.map((b) => b.id === id ? { ...b, ...patch } : b)
      return { ...prev, upcoming: patchList(prev.upcoming), completed: patchList(prev.completed), cancelled: patchList(prev.cancelled) }
    })
  }

  const styles = makeStyles(COLORS)

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={["top"]}><View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View></SafeAreaView>
  }

  const pendingCount = (data?.upcoming ?? []).filter((b) => b.status.toLowerCase() === "pending").length
  const upcomingBookings = data?.upcoming ?? []

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm }}>
        <View>
          <Text style={styles.pageTitle}>Welcome, {firstName}</Text>
          <Text style={styles.pageSub}>Manage your upcoming sessions.</Text>
        </View>
        {pendingCount > 0 && <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{pendingCount} pending</Text></View>}
      </View>

      {/* List / Calendar tabs */}
      <View style={{ flexDirection: "row", marginHorizontal: SPACING.md, marginBottom: SPACING.sm, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, overflow: "hidden" }}>
        {([["list", "List", List], ["calendar", "Calendar", CalendarDays]] as const).map(([value, label, Icon]) => (
          <TouchableOpacity key={value} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, backgroundColor: tab === value ? COLORS.primary : "transparent" }} onPress={() => setTab(value)} activeOpacity={0.8}>
            <Icon size={15} color={tab === value ? "#fff" : COLORS.textMuted} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: tab === value ? "#fff" : COLORS.textMuted }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={[styles.errorBox, { margin: SPACING.md }]}><Text style={styles.errorText}>{error}</Text></View>
      ) : tab === "calendar" ? (
        calConnected
          ? <CalendarView events={calEvents} bookings={upcomingBookings} refreshing={refreshing} onRefresh={onRefresh} />
          : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: SPACING.xl, gap: SPACING.md }}>
              <CalendarDays size={48} color={COLORS.textMuted} />
              <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text, textAlign: "center" }}>Connect Google Calendar</Text>
              <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center", lineHeight: 20 }}>
                Sign in with Google to automatically connect your calendar.
              </Text>
            </View>
          )
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming sessions</Text>
            {(data?.upcoming ?? []).length === 0 ? (
              <View style={styles.emptyCard}><Text style={styles.emptyText}>No upcoming sessions booked yet.</Text></View>
            ) : (data?.upcoming ?? []).map((b) => <BookingCard key={b.id} booking={b} onUpdate={handleUpdate} />)}
          </View>
          {(data?.completed ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: COLORS.textMuted }]}>Completed sessions</Text>
              {(data?.completed ?? []).map((b) => <BookingCard key={b.id} booking={b} dimmed onUpdate={handleUpdate} />)}
            </View>
          )}
          {(data?.cancelled ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: COLORS.textMuted }]}>Cancelled & Declined</Text>
              {(data?.cancelled ?? []).map((b) => <BookingCard key={b.id} booking={b} dimmed onUpdate={handleUpdate} />)}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function makeStyles(COLORS: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    scroll: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xl },
    pageTitle: { fontSize: 26, fontWeight: "700", color: COLORS.text, fontFamily: "Sora_700Bold" },
    pageSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
    pendingBadge: { backgroundColor: COLORS.red, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
    pendingBadgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },
    errorBox: { backgroundColor: COLORS.redLight, borderRadius: RADIUS.sm, padding: SPACING.sm },
    errorText: { fontSize: 13, color: COLORS.red },
    section: { gap: SPACING.sm },
    sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, fontFamily: "Sora_600SemiBold" },
    emptyCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, alignItems: "center" },
    emptyText: { fontSize: 14, color: COLORS.textMuted },
    card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
    cardPending: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
    cardHeader: { flexDirection: "row", alignItems: "center", padding: SPACING.md, gap: SPACING.sm },
    cardDateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    cardDate: { fontSize: 13, fontWeight: "600", color: COLORS.text },
    cardTime: { fontSize: 12, color: COLORS.textMuted },
    cardDancer: { fontSize: 15, fontWeight: "700", color: COLORS.text },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
    badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
    cardBody: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
    infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    infoText: { fontSize: 13, color: COLORS.textMuted, flex: 1 },
    actionRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: 4 },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
    actionBtnPrimary: { backgroundColor: COLORS.primary },
    actionBtnPrimaryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    actionBtnDanger: { borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redLight },
    actionBtnDangerText: { fontSize: 13, fontWeight: "700", color: COLORS.red },
    actionBtnGhost: { borderWidth: 1, borderColor: COLORS.border },
    actionBtnGhostText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
    editPanel: { gap: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
    editPanelTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text },
    editRow: { flexDirection: "row", gap: SPACING.sm },
    editLabel: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
    editInput: { backgroundColor: COLORS.background, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.sm, paddingVertical: 8, fontSize: 14, color: COLORS.text },
  })
}
