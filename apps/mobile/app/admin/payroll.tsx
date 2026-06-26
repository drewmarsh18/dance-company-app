import { useState, useCallback } from "react"
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, ScrollView, RefreshControl, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Search, ChevronDown, ChevronUp, X } from "lucide-react-native"
import { COLORS, SPACING, RADIUS } from "@/constants/theme"
import { useAdmin } from "@/lib/admin-context"
import type { AdminWorker, AdminBooking } from "@/lib/admin-types"

function currentMonthLabel() {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
}
function currentMonthPrefix() {
  return new Date().toISOString().slice(0, 7)
}

export default function AdminPayrollScreen() {
  const { data, loading, refresh } = useAdmin()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<AdminWorker | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const workers = data?.workers ?? []
  const bookings = data?.bookings ?? []

  const filtered = workers.filter(
    (w) =>
      !query ||
      w.name.toLowerCase().includes(query.toLowerCase()) ||
      w.email.toLowerCase().includes(query.toLowerCase()),
  )

  function bookingsFor(worker: AdminWorker): AdminBooking[] {
    return bookings.filter(
      (b) => b.prepMasterName === worker.name && b.date?.startsWith(currentMonthPrefix()),
    )
  }

  function completedFor(worker: AdminWorker) {
    return bookingsFor(worker).filter((b) => !b.status?.toLowerCase().startsWith("cancelled"))
  }

  function payOwed(worker: AdminWorker) {
    return completedFor(worker).length * worker.hourlyRate
  }

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
      <View style={styles.searchRow}>
        <Search size={16} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Prep Masters…"
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(w) => w.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {workers.length === 0 ? "No Prep Masters yet." : "No results."}
          </Text>
        }
        renderItem={({ item: w }) => {
          const sessions = completedFor(w).length
          const owed = payOwed(w)
          return (
            <TouchableOpacity style={styles.row} onPress={() => setSelected(w)} activeOpacity={0.7}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(w.name || "?").slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{w.name}</Text>
                <Text style={styles.sub}>{sessions} sessions this month · ${w.hourlyRate}/hr</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.payOwed}>${owed.toLocaleString()}</Text>
                <Text style={styles.payLabel}>this month</Text>
              </View>
              <ChevronDown size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )
        }}
      />

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <SafeAreaView style={styles.safe} edges={["top"]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selected.name}</Text>
                <Text style={styles.modalSub}>${selected.hourlyRate}/hr · {currentMonthLabel()}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8}>
                <X size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.detailBody}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{completedFor(selected).length}</Text>
                  <Text style={styles.summaryLabel}>Sessions</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: COLORS.green }]}>
                    ${payOwed(selected).toLocaleString()}
                  </Text>
                  <Text style={styles.summaryLabel}>Pay owed</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Bookings this month</Text>
              {bookingsFor(selected).length === 0 ? (
                <Text style={styles.empty}>No bookings this month.</Text>
              ) : (
                bookingsFor(selected).map((b) => <BookingRow key={b.id} booking={b} />)
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  )
}

function BookingRow({ booking: b }: { booking: AdminBooking }) {
  const [expanded, setExpanded] = useState(false)
  const isCancelled = b.status?.toLowerCase().startsWith("cancelled")
  const isConfirmed = b.status?.toLowerCase() === "confirmed"
  const badgeBg = isCancelled ? COLORS.redLight : isConfirmed ? COLORS.primaryLight : (COLORS.grayLight ?? "#f3f4f6")
  const badgeColor = isCancelled ? COLORS.red : isConfirmed ? COLORS.primary : COLORS.textMuted

  return (
    <View style={styles.bookingCard}>
      <TouchableOpacity style={styles.bookingRow} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookingName}>{b.dancerName || b.clientEmail || "Client"}</Text>
          <Text style={styles.bookingSub}>{b.date}{b.time ? ` · ${b.time}` : ""}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{b.status}</Text>
        </View>
        {expanded ? <ChevronUp size={14} color={COLORS.textMuted} /> : <ChevronDown size={14} color={COLORS.textMuted} />}
      </TouchableOpacity>
      {expanded && (
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>NOTES</Text>
          <Text style={styles.notesText}>{b.notes?.trim() || "No notes for this booking."}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchRow: {
    flexDirection: "row", alignItems: "center",
    margin: SPACING.md, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, height: 40, fontSize: 14, color: COLORS.text },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
  separator: { height: 1, backgroundColor: COLORS.border },
  empty: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.xl },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.md },
  avatar: {
    width: 40, height: 40, borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  name: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  payOwed: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  payLabel: { fontSize: 11, color: COLORS.textMuted },
  modalHeader: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  modalSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  detailBody: { padding: SPACING.md, gap: SPACING.md },
  summaryCard: {
    flexDirection: "row", backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryValue: { fontSize: 26, fontWeight: "700", color: COLORS.text },
  summaryLabel: { fontSize: 12, color: COLORS.textMuted },
  summaryDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.sm },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  bookingCard: { borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  bookingRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm },
  bookingName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  bookingSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  notesSection: { padding: SPACING.sm, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  notesLabel: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 4 },
  notesText: { fontSize: 13, color: COLORS.text },
})
