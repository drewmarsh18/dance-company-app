import React from "react"
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, RefreshControl, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useState, useCallback } from "react"
import { CalendarDays, DollarSign, TrendingUp, Activity, Award, Users, X, ChevronDown, ChevronUp } from "lucide-react-native"
import { SPACING, RADIUS } from "@/constants/theme"
import { useColors } from "@/lib/theme-context"
import { useAdmin } from "@/lib/admin-context"
import type { AdminBooking } from "@/lib/admin-types"
import { formatTime } from "@/components/BookingDetailModal"

const SESSION_PRICE: Record<string, number> = {
  "private-30": 65, "private-45": 89, "private-60": 99, "pack-hour": 99,
}
function sessionRevenue(sessionType: string | null) { return SESSION_PRICE[sessionType ?? ""] ?? 99 }
function currentMonthLabel() { return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }) }
function currentMonthPrefix() { return new Date().toISOString().slice(0, 7) }

function BookingItem({ booking: b }: { booking: AdminBooking }) {
  const COLORS = useColors()
  const styles = makeStyles(COLORS)
  const [expanded, setExpanded] = useState(false)
  const s = b.status.toLowerCase()
  const bg = s === "confirmed" ? COLORS.primaryLight : s.startsWith("cancelled") ? COLORS.redLight : COLORS.grayLight
  const text = s === "confirmed" ? COLORS.primary : s.startsWith("cancelled") ? COLORS.red : COLORS.textMuted
  return (
    <View style={styles.bookingCard}>
      <TouchableOpacity style={styles.bookingRow} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookingName}>{b.dancerName || b.clientEmail || "Client"}</Text>
          <Text style={styles.bookingSub}>{b.prepMasterName} · {b.date}{b.time ? ` · ${formatTime(b.time)}` : ""}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: bg }]}><Text style={[styles.badgeText, { color: text }]}>{b.status}</Text></View>
        {expanded ? <ChevronUp size={14} color={COLORS.textMuted} /> : <ChevronDown size={14} color={COLORS.textMuted} />}
      </TouchableOpacity>
      {expanded && (
        <View style={styles.bookingNotes}>
          <Text style={styles.notesLabel}>NOTES</Text>
          <Text style={styles.notesText}>{b.notes?.trim() || "No notes for this booking."}</Text>
        </View>
      )}
    </View>
  )
}

const STATUS_GROUPS = [
  { key: "confirmed",  label: "Confirmed",       match: (s: string) => s === "confirmed" },
  { key: "pending",    label: "Pending",          match: (s: string) => s === "pending" },
  { key: "completed",  label: "Completed",        match: (s: string) => s === "completed" },
  { key: "cancelled",  label: "Cancelled",        match: (s: string) => s.startsWith("cancelled") },
  { key: "declined",   label: "Declined",         match: (s: string) => s === "declined" },
  { key: "other",      label: "Other",            match: () => true },
]

function CollapsibleGroup({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  const COLORS = useColors()
  const [open, setOpen] = useState(false)
  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 4 }}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>
          {label} <Text style={{ fontWeight: "400" }}>({count})</Text>
        </Text>
        {open ? <ChevronUp size={14} color={COLORS.textMuted} /> : <ChevronDown size={14} color={COLORS.textMuted} />}
      </TouchableOpacity>
      {open && <View style={{ gap: SPACING.sm }}>{children}</View>}
    </View>
  )
}

function GroupedBookings({ bookings }: { bookings: AdminBooking[] }) {
  const groups = STATUS_GROUPS.map((g) => ({
    ...g,
    items: bookings.filter((b) => {
      const s = b.status?.toLowerCase() ?? ""
      // Assign to the first matching group only
      const idx = STATUS_GROUPS.findIndex((sg) => sg.match(s))
      return STATUS_GROUPS[idx]?.key === g.key
    }),
  })).filter((g) => g.items.length > 0)

  if (groups.length === 0) return null
  return (
    <View style={{ padding: SPACING.md, gap: 2 }}>
      {groups.map((g) => (
        <CollapsibleGroup key={g.key} label={g.label} count={g.items.length}>
          {g.items.map((b) => <BookingItem key={b.id} booking={b} />)}
        </CollapsibleGroup>
      ))}
    </View>
  )
}

function RosterRow({ label, value }: { label: string; value: number }) {
  const COLORS = useColors()
  const styles = makeStyles(COLORS)
  return (
    <View style={styles.rosterRow}>
      <Text style={styles.rosterLabel}>{label}</Text>
      <Text style={styles.rosterValue}>{value}</Text>
    </View>
  )
}

export default function AdminOverviewScreen() {
  const { data, loading, error, refresh } = useAdmin()
  const COLORS = useColors()
  const styles = makeStyles(COLORS)
  const [bookingsModalOpen, setBookingsModalOpen] = useState(false)
  const [revenueModalOpen, setRevenueModalOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => { setRefreshing(true); await refresh(); setRefreshing(false) }, [refresh])

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    )
  }

  const bookings = data?.bookings ?? []
  const workers = data?.workers ?? []
  const members = data?.members ?? []
  const thisMonth = bookings.filter((b) => b.date?.startsWith(currentMonthPrefix()))
  const completed = thisMonth.filter((b) => b.status?.toLowerCase() !== "cancelled")
  const cancelled = thisMonth.filter((b) => b.status?.toLowerCase().startsWith("cancelled"))
  const revenue = completed.reduce((sum, b) => sum + sessionRevenue(b.sessionType), 0)
  const allCompleted = bookings.filter((b) => b.status?.toLowerCase() !== "cancelled")
  const allRevenue = allCompleted.reduce((sum, b) => sum + sessionRevenue(b.sessionType), 0)
  const workerRateMap = new Map(workers.map((w) => [w.name, w.hourlyRate]))
  const payOwedThisMonth = completed.reduce((sum, b) => sum + (workerRateMap.get(b.prepMasterName) ?? 0), 0)
  const margin = revenue - payOwedThisMonth
  const pmCounts: Record<string, number> = {}
  completed.forEach((b) => { if (b.prepMasterName) pmCounts[b.prepMasterName] = (pmCounts[b.prepMasterName] ?? 0) + 1 })
  const topPMs = Object.entries(pmCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.month}>{currentMonthLabel()}</Text>
            <Text style={styles.subtitle}>Company performance snapshot</Text>
          </View>
          <View style={styles.liveBadge}><Text style={styles.liveText}>Live</Text></View>
        </View>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        <View style={styles.grid}>
          <TouchableOpacity style={[styles.kpiCard, styles.kpiCardClickable]} onPress={() => setBookingsModalOpen(true)} activeOpacity={0.7}>
            <View style={styles.kpiHeader}><CalendarDays size={14} color={COLORS.primary} /><Text style={styles.kpiLabel}>Bookings this month</Text></View>
            <Text style={styles.kpiValue}>{thisMonth.length}</Text>
            <Text style={styles.kpiSub}>{completed.length} completed · {cancelled.length} cancelled</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.kpiCard, styles.kpiCardClickable, { borderColor: "#bbf7d0" }]} onPress={() => setRevenueModalOpen(true)} activeOpacity={0.7}>
            <View style={styles.kpiHeader}><DollarSign size={14} color={COLORS.green} /><Text style={styles.kpiLabel}>Revenue this month</Text></View>
            <Text style={[styles.kpiValue, { color: COLORS.green }]}>${revenue.toLocaleString()}</Text>
            <Text style={styles.kpiSub}>{completed.length} completed sessions</Text>
          </TouchableOpacity>
          <View style={[styles.kpiCard, { borderColor: "#bbf7d0" }]}>
            <View style={styles.kpiHeader}><TrendingUp size={14} color={COLORS.primary} /><Text style={styles.kpiLabel}>Margin this month</Text></View>
            <Text style={[styles.kpiValue, { color: COLORS.green }]}>${margin.toLocaleString()}</Text>
            <Text style={styles.kpiSub}>Pay owed: ${payOwedThisMonth.toLocaleString()}</Text>
          </View>
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}><Activity size={14} color={COLORS.textMuted} /><Text style={styles.kpiLabel}>All-time revenue</Text></View>
            <Text style={styles.kpiValue}>${allRevenue.toLocaleString()}</Text>
            <Text style={styles.kpiSub}>{allCompleted.length} total sessions</Text>
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.cardHeader}><Award size={16} color={COLORS.primary} /><Text style={styles.cardTitle}>Top PrepMasters this month</Text></View>
          {topPMs.length === 0 ? <Text style={styles.empty}>No completed sessions yet this month.</Text> : topPMs.map(([name, count], i) => (
            <View key={name} style={styles.rosterRow}>
              <Text style={styles.rosterLabel}>#{i + 1} {name}</Text>
              <Text style={styles.rosterValue}>{count} session{count !== 1 ? "s" : ""}</Text>
            </View>
          ))}
        </View>
        <View style={styles.card}>
          <View style={styles.cardHeader}><Users size={16} color={COLORS.primary} /><Text style={styles.cardTitle}>Roster snapshot</Text></View>
          <RosterRow label="Total members" value={members.length} />
          <RosterRow label="Active PrepMasters" value={workers.filter((w) => w.active).length} />
          <RosterRow label="Inactive PrepMasters" value={workers.filter((w) => !w.active).length} />
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>ALL-TIME BOOKINGS BY STATUS</Text>
          <RosterRow label="Completed" value={allCompleted.length} />
          <RosterRow label="Cancelled" value={bookings.filter((b) => b.status?.toLowerCase().startsWith("cancelled")).length} />
          <RosterRow label="Pending" value={bookings.filter((b) => b.status?.toLowerCase() === "pending").length} />
        </View>
      </ScrollView>
      <Modal visible={revenueModalOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Revenue — {currentMonthLabel()}</Text>
            <TouchableOpacity onPress={() => setRevenueModalOpen(false)} hitSlop={8}><X size={22} color={COLORS.text} /></TouchableOpacity>
          </View>
          {completed.length === 0 ? (
            <Text style={[styles.empty, { padding: SPACING.md }]}>No billable sessions this month.</Text>
          ) : (
            <FlatList
              data={[...completed].sort((a, b) => (b.date > a.date ? 1 : -1))}
              keyExtractor={(b) => b.id}
              contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}
              ListFooterComponent={() => (
                <View style={styles.revenueTotal}>
                  <Text style={styles.revenueTotalLabel}>Total</Text>
                  <Text style={styles.revenueTotalValue}>${revenue.toLocaleString()}</Text>
                </View>
              )}
              renderItem={({ item: b }) => {
                const amt = sessionRevenue(b.sessionType)
                const sessionLabel = b.sessionType === "private-30" ? "30 min" : b.sessionType === "private-45" ? "45 min" : "60 min"
                return (
                  <View style={styles.revenueRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bookingName}>{b.dancerName || b.clientEmail || "Client"}</Text>
                      <Text style={styles.bookingSub}>{b.prepMasterName}{b.date ? ` · ${b.date}` : ""}{b.time ? ` · ${formatTime(b.time)}` : ""} · {sessionLabel}</Text>
                    </View>
                    <Text style={styles.revenueAmt}>${amt}</Text>
                  </View>
                )
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
      <Modal visible={bookingsModalOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bookings — {currentMonthLabel()}</Text>
            <TouchableOpacity onPress={() => setBookingsModalOpen(false)} hitSlop={8}><X size={22} color={COLORS.text} /></TouchableOpacity>
          </View>
          {thisMonth.length === 0 ? (
            <Text style={[styles.empty, { padding: SPACING.md }]}>No bookings this month yet.</Text>
          ) : (
            <ScrollView><GroupedBookings bookings={thisMonth} /></ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

function makeStyles(COLORS: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    month: { fontSize: 22, fontWeight: "700", color: COLORS.text, fontFamily: "Sora_700Bold" },
    subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
    liveBadge: { backgroundColor: COLORS.greenLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
    liveText: { fontSize: 12, fontWeight: "600", color: COLORS.green },
    errorBox: { backgroundColor: COLORS.redLight, borderRadius: RADIUS.sm, padding: SPACING.sm },
    errorText: { fontSize: 13, color: COLORS.red },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
    kpiCard: { width: "48%", backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md },
    kpiCardClickable: { borderColor: COLORS.primary + "40" },
    kpiHeader: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
    kpiLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "500", flex: 1 },
    kpiValue: { fontSize: 26, fontWeight: "700", color: COLORS.text, marginBottom: 2 },
    kpiSub: { fontSize: 11, color: COLORS.textMuted },
    card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    cardTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
    empty: { fontSize: 13, color: COLORS.textMuted },
    divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
    sectionLabel: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.8, textTransform: "uppercase" },
    rosterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    rosterLabel: { fontSize: 13, color: COLORS.textSecondary },
    rosterValue: { fontSize: 13, fontWeight: "600", color: COLORS.text },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    modalTitle: { fontSize: 17, fontWeight: "600", color: COLORS.text },
    bookingCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
    bookingRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm },
    bookingNotes: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.sm, backgroundColor: COLORS.background },
    notesLabel: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 4 },
    notesText: { fontSize: 13, color: COLORS.text },
    bookingName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
    bookingSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
    badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
    revenueRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm },
    revenueAmt: { fontSize: 15, fontWeight: "700", color: COLORS.green },
    revenueTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.md, marginTop: SPACING.sm },
    revenueTotalLabel: { fontSize: 14, fontWeight: "600", color: COLORS.text },
    revenueTotalValue: { fontSize: 16, fontWeight: "700", color: COLORS.green },
  })
}
