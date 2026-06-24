import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useState } from "react"
import { CalendarDays, DollarSign, TrendingUp, Activity, Award, Users, X } from "lucide-react-native"
import { COLORS, SPACING, RADIUS } from "@/constants/theme"
import { SINGLE_HOUR_PRICE } from "@cdp/core"

// --- Placeholder data (replace with real API calls) ---
const BOOKINGS: any[] = []
const WORKERS: any[] = []
const MEMBERS: any[] = []

function currentMonthLabel() {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

export default function AdminOverviewScreen() {
  const [bookingsModalOpen, setBookingsModalOpen] = useState(false)

  const thisMonth = BOOKINGS.filter((b) =>
    b.date?.startsWith(new Date().toISOString().slice(0, 7))
  )
  const completed = thisMonth.filter((b) => b.status?.toLowerCase() !== "cancelled")
  const cancelled = thisMonth.filter((b) => b.status?.toLowerCase() === "cancelled")
  const revenue = completed.length * SINGLE_HOUR_PRICE
  const allCompleted = BOOKINGS.filter((b) => b.status?.toLowerCase() !== "cancelled")
  const allRevenue = allCompleted.length * SINGLE_HOUR_PRICE

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.month}>{currentMonthLabel()}</Text>
            <Text style={styles.subtitle}>Company performance snapshot</Text>
          </View>
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>

        {/* KPI Grid */}
        <View style={styles.grid}>
          <TouchableOpacity style={[styles.kpiCard, styles.kpiCardClickable]} onPress={() => setBookingsModalOpen(true)} activeOpacity={0.7}>
            <View style={styles.kpiHeader}>
              <CalendarDays size={14} color={COLORS.primary} />
              <Text style={styles.kpiLabel}>Bookings this month</Text>
            </View>
            <Text style={styles.kpiValue}>{thisMonth.length}</Text>
            <Text style={styles.kpiSub}>{completed.length} completed · {cancelled.length} cancelled</Text>
          </TouchableOpacity>

          <View style={[styles.kpiCard, { borderColor: "#bbf7d0" }]}>
            <View style={styles.kpiHeader}>
              <DollarSign size={14} color={COLORS.green} />
              <Text style={styles.kpiLabel}>Revenue this month</Text>
            </View>
            <Text style={[styles.kpiValue, { color: COLORS.green }]}>${revenue.toLocaleString()}</Text>
            <Text style={styles.kpiSub}>${SINGLE_HOUR_PRICE}/session × {completed.length}</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: "#bbf7d0" }]}>
            <View style={styles.kpiHeader}>
              <TrendingUp size={14} color={COLORS.primary} />
              <Text style={styles.kpiLabel}>Margin this month</Text>
            </View>
            <Text style={[styles.kpiValue, { color: COLORS.green }]}>$0</Text>
            <Text style={styles.kpiSub}>Pay owed: $0</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Activity size={14} color={COLORS.textMuted} />
              <Text style={styles.kpiLabel}>All-time revenue</Text>
            </View>
            <Text style={styles.kpiValue}>${allRevenue.toLocaleString()}</Text>
            <Text style={styles.kpiSub}>{allCompleted.length} total sessions</Text>
          </View>
        </View>

        {/* Top Prep Masters */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Award size={16} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Top Prep Masters this month</Text>
          </View>
          <Text style={styles.empty}>No completed sessions yet this month.</Text>
        </View>

        {/* Roster Snapshot */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Users size={16} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Roster snapshot</Text>
          </View>
          <RosterRow label="Total members" value={MEMBERS.length} />
          <RosterRow label="Active Prep Masters" value={WORKERS.filter((w) => w.active).length} />
          <RosterRow label="Inactive Prep Masters" value={WORKERS.filter((w) => !w.active).length} />
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>ALL-TIME BOOKINGS BY STATUS</Text>
          <RosterRow label="Completed" value={allCompleted.length} />
          <RosterRow label="Cancelled" value={BOOKINGS.filter((b) => b.status?.toLowerCase() === "cancelled").length} />
          <RosterRow label="Pending" value={BOOKINGS.filter((b) => b.status?.toLowerCase() === "pending").length} />
        </View>
      </ScrollView>

      {/* Bookings Modal */}
      <Modal visible={bookingsModalOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bookings — {currentMonthLabel()}</Text>
            <TouchableOpacity onPress={() => setBookingsModalOpen(false)} hitSlop={8}>
              <X size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {thisMonth.length === 0 ? (
            <Text style={[styles.empty, { padding: SPACING.md }]}>No bookings this month yet.</Text>
          ) : (
            <FlatList
              data={thisMonth}
              keyExtractor={(b) => b.id}
              contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}
              renderItem={({ item: b }) => (
                <View style={styles.bookingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingName}>{b.dancerName || b.clientEmail || "Client"}</Text>
                    <Text style={styles.bookingSub}>{b.prepMasterName} · {b.date}{b.time ? ` · ${b.time}` : ""}</Text>
                  </View>
                  <StatusBadge status={b.status} />
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

function RosterRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.rosterRow}>
      <Text style={styles.rosterLabel}>{label}</Text>
      <Text style={styles.rosterValue}>{value}</Text>
    </View>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase()
  const bg = s === "confirmed" ? COLORS.primaryLight : s === "cancelled" ? COLORS.redLight : COLORS.grayLight
  const color = s === "confirmed" ? COLORS.primary : s === "cancelled" ? COLORS.red : COLORS.gray
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{status}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  month: { fontSize: 22, fontWeight: "700", color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  liveBadge: { backgroundColor: COLORS.greenLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  liveText: { fontSize: 12, fontWeight: "600", color: COLORS.green },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  kpiCard: {
    width: "48%", backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  kpiCardClickable: { borderColor: COLORS.primary + "40" },
  kpiHeader: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  kpiLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "500", flex: 1 },
  kpiValue: { fontSize: 26, fontWeight: "700", color: COLORS.text, marginBottom: 2 },
  kpiSub: { fontSize: 11, color: COLORS.textMuted },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  empty: { fontSize: 13, color: COLORS.textMuted },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.8, textTransform: "uppercase" },
  rosterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rosterLabel: { fontSize: 13, color: COLORS.textSecondary },
  rosterValue: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 17, fontWeight: "600", color: COLORS.text },
  bookingRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm,
  },
  bookingName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  bookingSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
})
