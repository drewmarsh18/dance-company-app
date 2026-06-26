import { useEffect, useState, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Ticket, CalendarClock, ChevronRight } from "lucide-react-native"
import { authClient, useSession } from "@/lib/auth-client"
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

type DashboardData = {
  profile: { name: string; creditsRemaining: number }
  upcoming: Booking[]
  past: Booking[]
}

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function formatTime(timeStr: string) {
  if (!timeStr) return ""
  const [h, m] = timeStr.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`
}

function BookingCard({ booking }: { booking: Booking }) {
  const isPast = new Date(`${booking.date}T00:00:00`).getTime() < new Date(new Date().toDateString()).getTime()
  return (
    <View style={[styles.bookingCard, isPast && styles.bookingCardPast]}>
      <View style={styles.bookingLeft}>
        <Text style={styles.bookingCoach}>{booking.prepMasterName || "Prep Master"}</Text>
        <Text style={styles.bookingDate}>{formatDate(booking.date)}{booking.time ? ` · ${formatTime(booking.time)}` : ""}</Text>
        {booking.sessionType ? <Text style={styles.bookingType}>{booking.sessionType}</Text> : null}
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusColor(booking.status).bg }]}>
        <Text style={[styles.statusText, { color: statusColor(booking.status).text }]}>{booking.status}</Text>
      </View>
    </View>
  )
}

function statusColor(status: string) {
  const s = status.toLowerCase()
  if (s === "confirmed") return { bg: COLORS.primaryLight, text: COLORS.primary }
  if (s.startsWith("cancelled")) return { bg: COLORS.redLight, text: COLORS.red }
  return { bg: COLORS.grayLight ?? "#f3f4f6", text: COLORS.textMuted }
}

export default function MemberHomeScreen() {
  const { data: session } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstName = session?.user?.name?.split(" ")[0] ?? "Dancer"

  const load = useCallback(async () => {
    try {
      const { data: result, error: err } = await authClient.$fetch(`${API_BASE}/api/member/dashboard`)
      if (err || !result) throw new Error((err as any)?.statusText ?? "Failed to load")
      setData(result as DashboardData)
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome, {firstName}.</Text>
          <Text style={styles.greetingSub}>Here&apos;s your training overview.</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Credits card */}
        <View style={styles.creditsCard}>
          <View style={styles.creditsLeft}>
            <Ticket size={18} color={COLORS.primary} />
            <Text style={styles.creditsLabel}>Sessions remaining</Text>
          </View>
          <Text style={styles.creditsValue}>{data?.profile.creditsRemaining ?? 0}</Text>
        </View>

        {/* Upcoming sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming sessions</Text>
          {(data?.upcoming?.length ?? 0) === 0 ? (
            <View style={styles.emptyCard}>
              <CalendarClock size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No upcoming sessions</Text>
              <Text style={styles.emptySub}>Book a private session with a prep master to get started.</Text>
            </View>
          ) : (
            data!.upcoming.map((b) => <BookingCard key={b.id} booking={b} />)
          )}
        </View>

        {/* Past sessions preview */}
        {(data?.past?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Past sessions</Text>
              <TouchableOpacity onPress={() => router.push("/member/bookings" as any)} style={styles.seeAll}>
                <Text style={styles.seeAllText}>See all</Text>
                <ChevronRight size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            {data!.past.slice(0, 3).map((b) => <BookingCard key={b.id} booking={b} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  header: { gap: 4 },
  greeting: { fontSize: 26, fontWeight: "700", color: COLORS.text },
  greetingSub: { fontSize: 14, color: COLORS.textMuted },
  errorBox: { backgroundColor: COLORS.redLight, borderRadius: RADIUS.sm, padding: SPACING.sm },
  errorText: { fontSize: 13, color: COLORS.red },
  creditsCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  creditsLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  creditsLabel: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  creditsValue: { fontSize: 32, fontWeight: "800", color: COLORS.primary },
  section: { gap: SPACING.sm },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontSize: 13, color: COLORS.primary, fontWeight: "600" },
  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.xl, alignItems: "center", gap: SPACING.sm,
  },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: "center" },
  bookingCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  bookingCardPast: { opacity: 0.7 },
  bookingLeft: { flex: 1, gap: 2 },
  bookingCoach: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  bookingDate: { fontSize: 12, color: COLORS.textMuted },
  bookingType: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
})
