import { useState, useCallback } from "react"
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, ScrollView, RefreshControl, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Search, ChevronRight, X, MapPin, DollarSign } from "lucide-react-native"
import { COLORS, SPACING, RADIUS } from "@/constants/theme"
import { useAdmin } from "@/lib/admin-context"
import type { AdminWorker, AdminBooking } from "@/lib/admin-types"

export default function AdminPrepMastersScreen() {
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
    return bookings.filter((b) => b.prepMasterName === worker.name)
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
            {workers.length === 0 ? "No Prep Masters yet." : "No Prep Masters match your search."}
          </Text>
        }
        renderItem={({ item: w }) => (
          <TouchableOpacity style={styles.row} onPress={() => setSelected(w)} activeOpacity={0.7}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(w.name || "?").slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{w.name}</Text>
              <Text style={styles.sub}>{w.region || w.email}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: w.active ? COLORS.greenLight : (COLORS.grayLight ?? "#f3f4f6") }]}>
              <Text style={[styles.statusText, { color: w.active ? COLORS.green : COLORS.textMuted }]}>
                {w.active ? "Active" : "Inactive"}
              </Text>
            </View>
            <ChevronRight size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <SafeAreaView style={styles.safe} edges={["top"]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selected.name}</Text>
                <Text style={styles.modalEmail}>{selected.email}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8}>
                <X size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.detailBody}>
              <View style={styles.statsRow}>
                <StatCard
                  icon={<DollarSign size={18} color={COLORS.green} />}
                  label="Pay rate"
                  value={`$${selected.hourlyRate}/hr`}
                />
                <StatCard
                  icon={<MapPin size={18} color={COLORS.primary} />}
                  label="Region"
                  value={selected.region || "—"}
                />
              </View>

              {selected.phone ? <DetailRow label="Phone" value={selected.phone} /> : null}
              {selected.university ? <DetailRow label="University" value={selected.university} /> : null}
              <DetailRow label="Status" value={selected.active ? "Active" : "Inactive"} />

              <Text style={styles.sectionTitle}>All-time sessions</Text>
              {bookingsFor(selected).length === 0 ? (
                <Text style={styles.empty}>No bookings recorded yet.</Text>
              ) : (
                bookingsFor(selected).map((b) => (
                  <View key={b.id} style={styles.bookingCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bookingName}>{b.dancerName || b.clientEmail || "Client"}</Text>
                      <Text style={styles.bookingSub}>{b.date}{b.time ? ` · ${b.time}` : ""}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: statusBg(b.status) }]}>
                      <Text style={[styles.badgeText, { color: statusFg(b.status) }]}>{b.status}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  )
}

function statusBg(s: string) {
  const l = s.toLowerCase()
  if (l === "confirmed") return COLORS.primaryLight
  if (l.startsWith("cancelled")) return COLORS.redLight
  return COLORS.grayLight ?? "#f3f4f6"
}
function statusFg(s: string) {
  const l = s.toLowerCase()
  if (l === "confirmed") return COLORS.primary
  if (l.startsWith("cancelled")) return COLORS.red
  return COLORS.textMuted
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: "600" },
  modalHeader: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  modalEmail: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  detailBody: { padding: SPACING.md, gap: SPACING.md },
  statsRow: { flexDirection: "row", gap: SPACING.sm },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: "700", color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textMuted },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  detailLabel: { fontSize: 14, color: COLORS.textMuted },
  detailValue: { fontSize: 14, fontWeight: "500", color: COLORS.text },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text, marginTop: SPACING.sm },
  bookingCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm,
  },
  bookingName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  bookingSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
})
