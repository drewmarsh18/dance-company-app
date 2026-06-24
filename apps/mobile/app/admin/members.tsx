import { useState } from "react"
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Search, ChevronRight, X, CreditCard } from "lucide-react-native"
import { COLORS, SPACING, RADIUS } from "@/constants/theme"

type Member = {
  id: string
  name: string
  email: string
  creditsRemaining: number
  phone?: string
}

// Placeholder — replace with real API fetch
const MEMBERS: Member[] = []

export default function AdminMembersScreen() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Member | null>(null)

  const filtered = MEMBERS.filter(
    (m) =>
      !query ||
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.email.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <Search size={16} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search members…"
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {MEMBERS.length === 0 ? "No members yet." : "No members match your search."}
          </Text>
        }
        renderItem={({ item: m }) => (
          <TouchableOpacity style={styles.row} onPress={() => setSelected(m)} activeOpacity={0.7}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{m.name.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{m.name}</Text>
              <Text style={styles.email}>{m.email}</Text>
            </View>
            <View style={styles.creditsBadge}>
              <Text style={styles.creditsText}>{m.creditsRemaining} cr</Text>
            </View>
            <ChevronRight size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      />

      {/* Member detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <SafeAreaView style={styles.safe} edges={["top"]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected.name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8}>
                <X size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.detailBody}>
              <DetailRow label="Email" value={selected.email} />
              {selected.phone && <DetailRow label="Phone" value={selected.phone} />}
              <View style={styles.divider} />
              <View style={styles.creditRow}>
                <CreditCard size={16} color={COLORS.primary} />
                <Text style={styles.creditLabel}>Credits remaining</Text>
                <Text style={styles.creditValue}>{selected.creditsRemaining}</Text>
              </View>
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
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
  creditsBadge: {
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  creditsText: { fontSize: 12, fontWeight: "600", color: COLORS.primary },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  detailBody: { padding: SPACING.md, gap: SPACING.sm },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { fontSize: 14, color: COLORS.textMuted },
  detailValue: { fontSize: 14, fontWeight: "500", color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  creditRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  creditLabel: { flex: 1, fontSize: 15, fontWeight: "500", color: COLORS.text },
  creditValue: { fontSize: 22, fontWeight: "700", color: COLORS.primary },
})
