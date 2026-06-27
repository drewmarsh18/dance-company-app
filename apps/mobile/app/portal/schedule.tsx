import { useEffect, useState, useCallback } from "react"
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Check, ChevronRight, ChevronDown, Calendar, Clock } from "lucide-react-native"
import { authClient } from "@/lib/auth-client"
import { SPACING, RADIUS } from "@/constants/theme"
import { useColors } from "@/lib/theme-context"

const API_BASE = "https://dance-company-app.vercel.app"

const WEEKDAYS = [
  { value: 0, label: "Sunday" }, { value: 1, label: "Monday" }, { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" }, { value: 5, label: "Friday" }, { value: 6, label: "Saturday" },
]

type DayAvailability = { dayOfWeek: number; enabled: boolean; startTime: string; endTime: string }
type CalEvent = { id: string; title: string; start: string; end: string; allDay: boolean }

function to12Hour(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":")
  let h = Number(hStr); const m = mStr ?? "00"
  const period = h >= 12 ? "PM" : "AM"
  if (h === 0) h = 12; else if (h > 12) h -= 12
  return `${h}:${m} ${period}`
}

function formatEventTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

function formatEventDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function groupEventsByDate(events: CalEvent[]): { dateLabel: string; dateIso: string; items: CalEvent[] }[] {
  const map = new Map<string, CalEvent[]>()
  for (const e of events) {
    const key = e.start.slice(0, 10)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateIso, items]) => ({ dateIso, dateLabel: formatEventDate(dateIso + "T00:00:00"), items }))
}

function TimePickerRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const COLORS = useColors()
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`)
  const [open, setOpen] = useState(false)
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{label}</Text>
      <TouchableOpacity style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 8, backgroundColor: COLORS.background }} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>{to12Hour(value)}</Text>
      </TouchableOpacity>
      {open && (
        <View style={{ position: "absolute", top: 56, left: 0, right: 0, zIndex: 100, backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, elevation: 8 }}>
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
            {hours.map((h) => (
              <TouchableOpacity key={h} style={{ paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: h === value ? COLORS.primaryLight : undefined }} onPress={() => { onChange(h); setOpen(false) }} activeOpacity={0.7}>
                <Text style={{ fontSize: 14, color: h === value ? COLORS.primary : COLORS.text, fontWeight: h === value ? "700" : "400" }}>{to12Hour(h)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

export default function PortalScheduleScreen() {
  const COLORS = useColors()
  const styles = makeStyles(COLORS)
  const [week, setWeek] = useState<DayAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [availExpanded, setAvailExpanded] = useState(false)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [calConnected, setCalConnected] = useState<boolean | null>(null)
  const [calLoading, setCalLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/portal/availability`)
      if (error || !data) throw new Error("Failed to load")
      setWeek((data as { week: DayAvailability[] }).week)
    } catch { Alert.alert("Error", "Could not load availability.") }
  }, [])

  const loadCalendar = useCallback(async () => {
    try {
      const now = new Date()
      const timeMin = now.toISOString()
      const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await authClient.$fetch(
        `${API_BASE}/api/portal/calendar-events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
      )
      const d = data as { connected: boolean; events: CalEvent[] }
      setCalConnected(d.connected)
      setEvents(d.events ?? [])
    } catch {
      setCalConnected(false)
    } finally {
      setCalLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([load(), loadCalendar()]).finally(() => setLoading(false))
  }, [load, loadCalendar])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([load(), loadCalendar()])
    setRefreshing(false)
  }, [load, loadCalendar])

  function updateDay(dayOfWeek: number, patch: Partial<DayAvailability>) {
    setWeek((prev) => prev.map((d) => d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d))
  }

  async function handleSave() {
    const invalid = week.find((d) => d.enabled && d.endTime <= d.startTime)
    if (invalid) {
      const label = WEEKDAYS.find((w) => w.value === invalid.dayOfWeek)?.label
      Alert.alert("Invalid time range", `${label}'s end time must be after its start time.`)
      return
    }
    setSaving(true)
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/portal/availability`, {
        method: "POST", body: JSON.stringify({ week }), headers: { "Content-Type": "application/json" },
      })
      if (error) throw new Error((error as any)?.message ?? "Failed")
      const res = data as { ok: boolean; error?: string }
      if (!res.ok) throw new Error(res.error ?? "Failed")
      Alert.alert("Saved", "Dancers can now book within these hours.")
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Could not save availability.") }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    )
  }

  const grouped = groupEventsByDate(events)

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Schedule</Text>
          <Text style={styles.pageSub}>Your calendar and booking availability.</Text>
        </View>

        {/* Collapsible availability */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.collapseHeader} onPress={() => setAvailExpanded((v) => !v)} activeOpacity={0.7}>
            <Text style={styles.collapseTitle}>Booking availability</Text>
            <ChevronDown size={18} color={COLORS.textMuted} style={{ transform: [{ rotate: availExpanded ? "180deg" : "0deg" }] }} />
          </TouchableOpacity>
          {availExpanded && (
            <>
              {week.map((day, idx) => {
                const label = WEEKDAYS.find((w) => w.value === day.dayOfWeek)?.label ?? ""
                const isLast = idx === week.length - 1
                return (
                  <View key={day.dayOfWeek} style={[styles.dayRow, !isLast && styles.dayRowBorder]}>
                    <View style={styles.dayLeft}>
                      <Switch value={day.enabled} onValueChange={(v) => updateDay(day.dayOfWeek, { enabled: v })} trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor="#fff" />
                      <Text style={[styles.dayLabel, !day.enabled && { color: COLORS.textMuted }]}>{label}</Text>
                    </View>
                    {day.enabled ? (
                      <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: 4 }}>
                        <TimePickerRow label="From" value={day.startTime} onChange={(v) => updateDay(day.dayOfWeek, { startTime: v })} />
                        <TimePickerRow label="To" value={day.endTime} onChange={(v) => updateDay(day.dayOfWeek, { endTime: v })} />
                      </View>
                    ) : (
                      <Text style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>Unavailable</Text>
                    )}
                  </View>
                )
              })}
              <View style={styles.saveRow}>
                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <><Check size={16} color="#fff" /><Text style={styles.saveBtnText}>Save availability</Text></>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Google Calendar */}
        <View style={styles.sectionHeader}>
          <Calendar size={16} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Google Calendar</Text>
          <Text style={styles.sectionSub}>Next 30 days</Text>
        </View>

        {calLoading ? (
          <View style={styles.calLoading}><ActivityIndicator size="small" color={COLORS.primary} /></View>
        ) : !calConnected ? (
          <View style={styles.calEmpty}>
            <Calendar size={28} color={COLORS.textMuted} />
            <Text style={styles.calEmptyTitle}>Calendar not connected</Text>
            <Text style={styles.calEmptySub}>Connect Google Calendar from the web portal to see your events here.</Text>
          </View>
        ) : grouped.length === 0 ? (
          <View style={styles.calEmpty}>
            <Calendar size={28} color={COLORS.textMuted} />
            <Text style={styles.calEmptyTitle}>No upcoming events</Text>
            <Text style={styles.calEmptySub}>Your Google Calendar events for the next 30 days will appear here.</Text>
          </View>
        ) : (
          grouped.map(({ dateIso, dateLabel, items }) => (
            <View key={dateIso} style={styles.dayGroup}>
              <Text style={styles.dayGroupLabel}>{dateLabel}</Text>
              {items.map((e) => (
                <View key={e.id} style={styles.eventCard}>
                  <View style={styles.eventDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{e.title}</Text>
                    {!e.allDay && (
                      <View style={styles.eventTimeRow}>
                        <Clock size={11} color={COLORS.textMuted} />
                        <Text style={styles.eventTime}>{formatEventTime(e.start)} – {formatEventTime(e.end)}</Text>
                      </View>
                    )}
                    {e.allDay && <Text style={styles.eventTime}>All day</Text>}
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(COLORS: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
    pageHeader: { gap: 4 },
    pageTitle: { fontSize: 26, fontWeight: "700", color: COLORS.text },
    pageSub: { fontSize: 13, color: COLORS.textMuted },
    card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
    collapseHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md },
    collapseTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text },
    dayRow: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.sm },
    dayRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
    dayLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    dayLabel: { fontSize: 15, fontWeight: "600", color: COLORS.text, width: 90 },
    saveRow: { padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
    saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingVertical: 12, paddingHorizontal: SPACING.md },
    saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: SPACING.sm },
    sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, flex: 1 },
    sectionSub: { fontSize: 12, color: COLORS.textMuted },
    calLoading: { paddingVertical: SPACING.xl, alignItems: "center" },
    calEmpty: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.xl, alignItems: "center", gap: SPACING.sm },
    calEmptyTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
    calEmptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: "center" },
    dayGroup: { gap: SPACING.xs },
    dayGroupLabel: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginTop: SPACING.sm },
    eventCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm },
    eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 4 },
    eventTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
    eventTimeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    eventTime: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  })
}
