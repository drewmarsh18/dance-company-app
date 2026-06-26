import { useEffect, useState, useCallback } from "react"
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Ticket, Package, CalendarClock, ChevronRight, CalendarPlus } from "lucide-react-native"
import { authClient, useSession } from "@/lib/auth-client"
import { COLORS, SPACING, RADIUS } from "@/constants/theme"

const API_BASE = "https://dance-company-app.vercel.app"

type MemberPlan = {
  id: string
  userId: string
  planName: string
  sessions: number
  pricePaid: number
  purchasedAt: string
  expiresAt: string
  status: string
}

type Booking = {
  id: string
  prepMasterName: string
  date: string
  time: string
  status: string
  sessionType: string | null
  notes?: string
}

type DashboardData = {
  profile: { name: string; creditsRemaining: number }
  plans: MemberPlan[]
  upcoming: Booking[]
  past: Booking[]
  cancelled: Booking[]
}

function planDisplayStatus(plan: MemberPlan): string {
  if (plan.status === "Active" && plan.expiresAt && new Date(plan.expiresAt) < new Date()) return "Inactive"
  return plan.status
}

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function formatTime(timeStr: string) {
  if (!timeStr) return ""
  const [h, m] = timeStr.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`
}

function statusColor(status: string) {
  const s = status.toLowerCase()
  if (s === "confirmed") return { bg: COLORS.primaryLight, text: COLORS.primary }
  if (s.startsWith("cancelled")) return { bg: COLORS.redLight, text: COLORS.red }
  return { bg: COLORS.grayLight, text: COLORS.textMuted }
}

function CreditsCard({ plans, credits }: { plans: MemberPlan[]; credits: number }) {
  const activePlans = plans.filter((p) => planDisplayStatus(p) === "Active")
  const historyPlans = plans.filter((p) => planDisplayStatus(p) !== "Active")
  const hasHistory = historyPlans.length > 0
  const isEmpty = credits === 0 && plans.length === 0

  const [view, setView] = useState<"active" | "history">(activePlans.length > 0 ? "active" : "history")
  const shownPlans = view === "active" ? activePlans : historyPlans

  const activeSingleCount = activePlans.filter((p) => p.sessions === 1).length

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderLeft}>
          <Ticket size={16} color={COLORS.primary} />
          <Text style={styles.cardHeaderTitle}>Session credits</Text>
        </View>
        {hasHistory && (
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, view === "active" && styles.toggleBtnActive]}
              onPress={() => setView("active")}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, view === "active" && styles.toggleTextActive]}>Active</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, view === "history" && styles.toggleBtnActive]}
              onPress={() => setView("history")}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, view === "history" && styles.toggleTextActive]}>History</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isEmpty ? (
        <Text style={styles.emptyText}>Purchase a package to start booking.</Text>
      ) : shownPlans.length === 0 ? (
        <Text style={styles.emptyText}>
          {view === "active" ? "No active credits." : "No used credits yet."}
        </Text>
      ) : (
        shownPlans.map((plan) => {
          const status = planDisplayStatus(plan)
          const isActive = status === "Active"
          const displayCount = !isActive
            ? plan.sessions
            : plan.sessions === 1
              ? 1
              : Math.max(0, credits - activeSingleCount)
          const expiryDate = plan.expiresAt
            ? new Date(plan.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : null
          const statusBg = status === "Active" ? COLORS.greenLight : COLORS.amberLight
          const statusFg = status === "Active" ? COLORS.green : COLORS.amber

          return (
            <View key={plan.id} style={styles.planItem}>
              <View style={styles.planRow}>
                <Package size={13} color={COLORS.primary} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>
                    {plan.planName}
                    {isActive && (
                      <Text style={styles.planCredits}>{"  "}{displayCount} {displayCount === 1 ? "credit" : "credits"} remaining</Text>
                    )}
                  </Text>
                  {expiryDate && <Text style={styles.planExpiry}>Expires {expiryDate}</Text>}
                </View>
                <View style={[styles.planBadge, { backgroundColor: statusBg }]}>
                  <Text style={[styles.planBadgeText, { color: statusFg }]}>{status}</Text>
                </View>
              </View>
            </View>
          )
        })
      )}
    </View>
  )
}

function BookingCard({ booking, dimmed }: { booking: Booking; dimmed?: boolean }) {
  const sc = statusColor(booking.status)
  return (
    <View style={[styles.bookingCard, dimmed && { opacity: 0.65 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.bookingCoach}>{booking.prepMasterName || "Prep Master"}</Text>
        <Text style={styles.bookingDate}>
          {formatDate(booking.date)}{booking.time ? ` · ${formatTime(booking.time)}` : ""}
        </Text>
        {booking.sessionType ? <Text style={styles.bookingType}>{booking.sessionType}</Text> : null}
      </View>
      <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
        <Text style={[styles.statusText, { color: sc.text }]}>{booking.status}</Text>
      </View>
    </View>
  )
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

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    )
  }

  const plans = data?.plans ?? []
  const credits = data?.profile.creditsRemaining ?? 0
  const upcoming = data?.upcoming ?? []
  const past = data?.past ?? []
  const cancelled = data?.cancelled ?? []

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome, {firstName}.</Text>
          <Text style={styles.greetingSub}>Here's your training overview.</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
        ) : null}

        <CreditsCard plans={plans} credits={credits} />

        {/* Book a session CTA */}
        <TouchableOpacity style={styles.bookCta} onPress={() => router.push("/member/book" as any)} activeOpacity={0.7}>
          <View style={styles.bookCtaLeft}>
            <CalendarPlus size={18} color={COLORS.primary} />
            <View>
              <Text style={styles.bookCtaTitle}>Ready to train?</Text>
              <Text style={styles.bookCtaSub}>Browse prep masters and book your next session.</Text>
            </View>
          </View>
          <View style={styles.bookCtaBtn}>
            <Text style={styles.bookCtaBtnText}>Book</Text>
          </View>
        </TouchableOpacity>

        {/* Upcoming sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming sessions</Text>
          {upcoming.length === 0 ? (
            <View style={styles.emptyCard}>
              <CalendarClock size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No upcoming sessions</Text>
              <Text style={styles.emptySub}>Book a private session with a prep master to get started.</Text>
            </View>
          ) : (
            upcoming.map((b) => <BookingCard key={b.id} booking={b} />)
          )}
        </View>

        {/* Past sessions */}
        {past.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: COLORS.textMuted }]}>Past sessions</Text>
              <TouchableOpacity onPress={() => router.push("/member/bookings" as any)} style={styles.seeAll}>
                <Text style={styles.seeAllText}>See all</Text>
                <ChevronRight size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            {past.slice(0, 3).map((b) => <BookingCard key={b.id} booking={b} dimmed />)}
          </View>
        )}

        {/* Cancelled sessions */}
        {cancelled.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.textMuted }]}>Cancelled sessions</Text>
            {cancelled.slice(0, 3).map((b) => <BookingCard key={b.id} booking={b} dimmed />)}
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

  // Credits card
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardHeaderTitle: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  toggle: { flexDirection: "row", backgroundColor: COLORS.grayLight, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: 2 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.sm - 2 },
  toggleBtnActive: { backgroundColor: COLORS.background, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  toggleText: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted },
  toggleTextActive: { color: COLORS.text },
  emptyText: { fontSize: 13, color: COLORS.textMuted },
  planItem: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, backgroundColor: COLORS.background },
  planRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  planName: { fontSize: 13, fontWeight: "600", color: COLORS.text, flex: 1 },
  planCredits: { fontSize: 13, fontWeight: "400", color: COLORS.textMuted },
  planExpiry: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  planBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  planBadgeText: { fontSize: 11, fontWeight: "600" },

  // Book CTA
  bookCta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
  bookCtaLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 },
  bookCtaTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  bookCtaSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  bookCtaBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full },
  bookCtaBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // Sections
  section: { gap: SPACING.sm },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontSize: 13, color: COLORS.primary, fontWeight: "600" },
  emptyCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.xl, alignItems: "center", gap: SPACING.sm },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: "center" },

  // Booking cards
  bookingCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md },
  bookingCoach: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  bookingDate: { fontSize: 12, color: COLORS.textMuted },
  bookingType: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
})
