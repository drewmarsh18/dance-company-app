import { useState } from "react"
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Search, ChevronRight, X, MapPin, DollarSign } from "lucide-react-native"
import { COLORS, SPACING, RADIUS } from "@/constants/theme"

type Worker = {
  id: string
  name: string
  email: string
  phone?: string
  region?: string
  hourlyRate: number
  active: boolean
}

// Placeholder — replace with real API fetch
const WORKERS: Worker[] = []

export default function AdminPrepMastersScreen() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Worker | null>(null)

  const filtered = WORKERS.filter(
    (w) =>
      !query ||
      w.name.toLowerCase().includes(query.toLowerCase()) ||
      w.email.toLowerCase().includes(query.toLowerCase()),
  )

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
            {WORKERS.length === 0 ? "No Prep Masters yet." : "No Prep Masters match your search."}
          </Text>
        }
        renderItem={({ item: w }) => (
          <TouchableOpacity style={styles.row} onPress={() => setSelected(w)} activeOpacity={0.7}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{w.name.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{w.name}</Text>
              <Text style={styles.email}>{w.region || w.email}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: w.active ? COLORS.greenLight : COLORS.grayLight }]}>
              <Text style={[styles.statusText, { color: w.active ? COLORS.green : COLORS.gray }]}>
                {w.active ? "Active" : "Inactive"}
              </Text>
            </View>
            <ChevronRight size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      />

      {/* Prep Master detail modal */}
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
                <StatCard icon={<DollarSign size={18} color={COLORS.green} />} label="Pay rate" value={`$${selected.hourlyRate}/hr`} />
                <StatCard icon={<MapPin size={18} color={COLORS.primary} />} label="Region" value={selected.region || "—"} />
              </View>

              {selected.phone && <DetailRow label="Phone" value={selected.phone} />}
              <DetailRow label="Status" value={selected.active ? "Active" : "Inactive"} />

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Booking History</Text>
              </View>
              <Text style={styles.empty}>No bookings recorded yet.</Text>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  )
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
  email: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: "600" },
  modalHeader: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  modalEmail: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  detailBody: { padding: SPACING.md, gap: SPACING.sm },
  statsRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: 4, alignItems: "flex-start",
  },
  statValue: { fontSize: 20, fontWeight: "700", color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textMuted },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  detailLabel: { fontSize: 14, color: COLORS.textMuted },
  detailValue: { fontSize: 14, fontWeight: "500", color: COLORS.text },
  sectionHeader: { marginTop: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
})
