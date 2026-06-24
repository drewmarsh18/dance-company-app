import { useState } from "react"
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Search, ChevronDown, ChevronUp, X } from "lucide-react-native"
import { COLORS, SPACING, RADIUS } from "@/constants/theme"

type Worker = {
  id: string
  name: string
  email: string
  region?: string
  hourlyRate: number
  active: boolean
}

// Placeholder — replace with real API fetch
const WORKERS: Worker[] = []
const BOOKINGS: any[] = []

function currentMonthLabel() {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

export default function AdminPayrollScreen() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Worker | null>(null)

  const filtered = WORKERS.filter(
    (w) =>
      !query ||
      w.name.toLowerCase().includes(query.toLowerCase()) ||
      w.email.toLowerCase().includes(query.toLowerCase()),
  )

  function bookingsFor(worker: Worker) {
    return BOOKINGS.filter((b) => b.prepMasterName === worker.name)
  }

  function payOwed(worker: Worker) {
    const completed = bookingsFor(worker).filter((b) => b.status?.toLowerCase() !== "cancelled")
    return completed.length * worker.hourlyRate
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
        ListEmptyComponent={
          <Text style={styles.empty}>
            {WORKERS.length === 0 ? "No Prep Masters yet." : "No results."}
          </Text>
        }
        renderItem={({ item: w }) => {
          const sessions = bookingsFor(w).filter((b) => b.status?.toLowerCase() !== "cancelled").length
          const owed = payOwed(w)
          return (
            <TouchableOpacity style={styles.row} onPress={() => setSelected(w)} activeOpacity={0.7}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{w.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{w.name}</Text>
                <Text style={styles.sub}>{sessions} sessions · ${w.hourlyRate}/hr</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.payOwed}>${owed.toLocaleString()}</Text>
                <Text style={styles.payLabel}>pay owed</Text>
              </View>
              <ChevronDown size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )
        }}
      />

      {/* Payroll detail modal */}
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
              {/* Summary */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {bookingsFor(selected).filter((b) => b.status?.toLowerCase() !== "cancelled").length}
                  </Text>
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

              <Text style={styles.sectionTitle}>Booking History</Text>
              {bookingsFor(selected).length === 0 ? (
                <Text style={styles.empty}>No bookings recorded.</Text>
              ) : (
                bookingsFor(selected).map((b) => (
                  <BookingRow key={b.id} booking={b} />
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  )
}

function BookingRow({ booking: b }: { booking: any }) {
  const [expanded, setExpanded] = useState(false)
  const isCancelled = b.status?.toLowerCase() === "cancelled"
  const badgeBg = isCancelled ? COLORS.redLight : b.status?.toLowerCase() === "confirmed" ? COLORS.primaryLight : COLORS.grayLight
  const badgeColor = isCancelled ? COLORS.red : b.status?.toLowerCase() === "confirmed" ? COLORS.primary : COLORS.gray

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
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryValue: { fontSize: 26, fontWeight: "700", color: COLORS.text },
  summaryLabel: { fontSize: 12, color: COLORS.textMuted },
  summaryDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.sm },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  bookingCard: {
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  bookingRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm },
  bookingName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  bookingSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  notesSection: { padding: SPACING.sm, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  notesLabel: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 4 },
  notesText: { fontSize: 13, color: COLORS.text },
})
