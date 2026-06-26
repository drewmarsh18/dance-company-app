import { useEffect, useState, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Plus } from "lucide-react-native"
import { authClient } from "@/lib/auth-client"
import { COLORS, SPACING, RADIUS } from "@/constants/theme"

const API_BASE = "https://dance-company-app.vercel.app"

type Booking = {
  id: string
  prepMasterName: string
  date: string
  time: string
  status: string
  sessionType: string | null
}

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
}

function formatTime(timeStr: string) {
  if (!timeStr) return ""
  const [h, m] = timeStr.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`
}

function statusColor(status: string) {
  const s = status.toLowerCase()
  if (s === "confirmed") return { bg: COLORS.primaryLight, text: COLORS.primary }
  if (s.startsWith("cancelled")) return { bg: COLORS.redLight, text: COLORS.red }
  return { bg: COLORS.grayLight ?? "#f3f4f6", text: COLORS.textMuted }
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingLeft}>
        <Text style={styles.bookingCoach}>{booking.prepMasterName || "Prep Master"}</Text>
        <Text style={styles.bookingDate}>
          {formatDate(booking.date)}{booking.time ? ` · ${formatTime(booking.time)}` : ""}
        </Text>
        {booking.sessionType ? <Text style={styles.bookingType}>{booking.sessionType}</Text> : null}
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusColor(booking.status).bg }]}>
        <Text style={[styles.statusText, { color: statusColor(booking.status).text }]}>{booking.status}</Text>
      </View>
    </View>
  )
}

export default function MemberBookingsScreen() {
  const router = useRouter()
  const [sections, setSections] = useState<{ title: string; data: Booking[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { data, error: err } = await authClient.$fetch(`${API_BASE}/api/member/dashboard`)
      if (err || !data) throw new Error((err as any)?.statusText ?? "Failed to load")
      const d = data as { upcoming: Booking[]; past: Booking[]; cancelled: Booking[] }
      const built: { title: string; data: Booking[] }[] = []
      if (d.upcoming.length > 0) built.push({ title: "Upcoming", data: d.upcoming })
      if (d.past.length > 0) built.push({ title: "Past", data: d.past })
      if (d.cancelled.length > 0) built.push({ title: "Cancelled", data: d.cancelled })
      setSections(built)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    }
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>My Bookings</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push("/member/book" as any)} activeOpacity={0.7}>
          <Plus size={16} color="#fff" />
          <Text style={styles.newBtnText}>New Booking</Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySub}>Your sessions will appear here once booked.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => <BookingCard booking={item} />}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          SectionSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: SPACING.lg, gap: SPACING.sm },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: 26, fontWeight: "700", color: COLORS.text },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
  newBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  errorBox: { margin: SPACING.md, backgroundColor: COLORS.redLight, borderRadius: RADIUS.sm, padding: SPACING.sm },
  errorText: { fontSize: 13, color: COLORS.red },
  list: { padding: SPACING.md, paddingTop: 0, paddingBottom: SPACING.xl },
  sectionHeader: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: SPACING.sm },
  bookingCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  bookingLeft: { flex: 1, gap: 2 },
  bookingCoach: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  bookingDate: { fontSize: 12, color: COLORS.textMuted },
  bookingType: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: "center" },
})
