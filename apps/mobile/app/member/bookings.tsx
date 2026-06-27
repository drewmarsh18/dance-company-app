import { useEffect, useState, useCallback } from "react"
import {
  View, Text, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Plus, ChevronRight } from "lucide-react-native"
import { authClient } from "@/lib/auth-client"
import { SPACING, RADIUS } from "@/constants/theme"
import { useColors } from "@/lib/theme-context"
import { BookingDetailModal, formatDate, formatTime, type Booking } from "@/components/BookingDetailModal"

const API_BASE = "https://dance-company-app.vercel.app"

function BookingCard({ booking, onPress }: { booking: Booking; onPress?: () => void }) {
  const COLORS = useColors()
  const s = booking.status.toLowerCase()
  const sc = s === "confirmed" ? { bg: COLORS.primaryLight, text: COLORS.primary }
    : s.startsWith("cancelled") ? { bg: COLORS.redLight, text: COLORS.red }
    : { bg: COLORS.grayLight, text: COLORS.textMuted }
  const inner = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>{booking.prepMasterName || "Prep Master"}</Text>
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

export default function MemberBookingsScreen() {
  const router = useRouter()
  const COLORS = useColors()
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

  const load = useCallback(async () => {
    try {
      const { data, error: err } = await authClient.$fetch(`${API_BASE}/api/member/dashboard`)
      if (err || !data) throw new Error((err as any)?.statusText ?? "Failed to load")
      const d = data as { upcoming: Booking[]; past: Booking[]; cancelled: Booking[] }
      setUpcoming(d.upcoming ?? [])
      setPast(d.past ?? [])
      setCancelled(d.cancelled ?? [])
      setError(null)
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
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm }}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: COLORS.text }}>My Bookings</Text>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full }} onPress={() => router.push("/member/book" as any)} activeOpacity={0.7}>
          <Plus size={16} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>New Booking</Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <View style={{ margin: SPACING.md, backgroundColor: COLORS.redLight, borderRadius: RADIUS.sm, padding: SPACING.sm }}>
          <Text style={{ fontSize: 13, color: COLORS.red }}>{error}</Text>
        </View>
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
