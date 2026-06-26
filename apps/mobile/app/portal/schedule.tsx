import { useEffect, useState, useCallback } from "react"
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Check } from "lucide-react-native"
import { authClient } from "@/lib/auth-client"
import { COLORS, SPACING, RADIUS } from "@/constants/theme"

const API_BASE = "https://dance-company-app.vercel.app"

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

type DayAvailability = {
  dayOfWeek: number
  enabled: boolean
  startTime: string
  endTime: string
}

function to12Hour(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":")
  let h = Number(hStr)
  const m = mStr ?? "00"
  const period = h >= 12 ? "PM" : "AM"
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m} ${period}`
}

function TimePickerRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`)
  const [open, setOpen] = useState(false)

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.timeLabel}>{label}</Text>
      <TouchableOpacity style={styles.timePicker} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
        <Text style={styles.timePickerText}>{to12Hour(value)}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.timeDropdown}>
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
            {hours.map((h) => (
              <TouchableOpacity
                key={h}
                style={[styles.timeOption, h === value && styles.timeOptionSelected]}
                onPress={() => { onChange(h); setOpen(false) }}
                activeOpacity={0.7}
              >
                <Text style={[styles.timeOptionText, h === value && { color: COLORS.primary, fontWeight: "700" }]}>
                  {to12Hour(h)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

export default function PortalScheduleScreen() {
  const [week, setWeek] = useState<DayAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/portal/availability`)
      if (error || !data) throw new Error("Failed to load")
      setWeek((data as { week: DayAvailability[] }).week)
    } catch {
      Alert.alert("Error", "Could not load availability.")
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

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
        method: "POST",
        body: JSON.stringify({ week }),
        headers: { "Content-Type": "application/json" },
      })
      if (error) throw new Error((error as any)?.message ?? "Failed")
      const res = data as { ok: boolean; error?: string }
      if (!res.ok) throw new Error(res.error ?? "Failed")
      Alert.alert("Saved", "Dancers can now book within these hours.")
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save availability.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Your availability</Text>
          <Text style={styles.pageSub}>Set the weekly hours you're open for private sessions.</Text>
        </View>

        <View style={styles.card}>
          {week.map((day, idx) => {
            const label = WEEKDAYS.find((w) => w.value === day.dayOfWeek)?.label ?? ""
            const isLast = idx === week.length - 1
            return (
              <View key={day.dayOfWeek} style={[styles.dayRow, !isLast && styles.dayRowBorder]}>
                <View style={styles.dayLeft}>
                  <Switch
                    value={day.enabled}
                    onValueChange={(v) => updateDay(day.dayOfWeek, { enabled: v })}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor="#fff"
                  />
                  <Text style={[styles.dayLabel, !day.enabled && { color: COLORS.textMuted }]}>{label}</Text>
                </View>
                {day.enabled ? (
                  <View style={styles.timePickers}>
                    <TimePickerRow
                      label="From"
                      value={day.startTime}
                      onChange={(v) => updateDay(day.dayOfWeek, { startTime: v })}
                    />
                    <TimePickerRow
                      label="To"
                      value={day.endTime}
                      onChange={(v) => updateDay(day.dayOfWeek, { endTime: v })}
                    />
                  </View>
                ) : (
                  <Text style={styles.unavailableText}>Unavailable</Text>
                )}
              </View>
            )
          })}
        </View>

        <View style={styles.saveRow}>
          <Text style={styles.saveHint}>Dancers can book hourly sessions within these windows.</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Check size={16} color="#fff" /><Text style={styles.saveBtnText}>Save availability</Text></>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xl },
  pageHeader: { gap: 4 },
  pageTitle: { fontSize: 26, fontWeight: "700", color: COLORS.text },
  pageSub: { fontSize: 13, color: COLORS.textMuted },

  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  dayRow: { padding: SPACING.md, gap: SPACING.sm },
  dayRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dayLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  dayLabel: { fontSize: 15, fontWeight: "600", color: COLORS.text, width: 90 },
  unavailableText: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  timePickers: { flexDirection: "row", gap: SPACING.sm, marginTop: 4 },
  timeLabel: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  timePicker: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 8,
    backgroundColor: COLORS.background,
  },
  timePickerText: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  timeDropdown: {
    position: "absolute", top: 56, left: 0, right: 0, zIndex: 100,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  timeOption: { paddingHorizontal: SPACING.md, paddingVertical: 10 },
  timeOptionSelected: { backgroundColor: COLORS.primaryLight },
  timeOptionText: { fontSize: 14, color: COLORS.text },

  saveRow: { gap: SPACING.sm },
  saveHint: { fontSize: 13, color: COLORS.textMuted },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingVertical: 12, paddingHorizontal: SPACING.md,
  },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
})
