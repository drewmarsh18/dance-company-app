import { useState, useCallback } from "react"
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, RefreshControl, ActivityIndicator, Alert, Switch,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import {
  Search, ChevronDown, ChevronUp, Plus, X, ArrowLeft,
  DollarSign, CalendarDays, User, Mail, Phone, Home, ChevronRight,
} from "lucide-react-native"
import { COLORS, SPACING, RADIUS } from "@/constants/theme"
import { useAdmin } from "@/lib/admin-context"
import { authClient } from "@/lib/auth-client"
import type { AdminWorker, AdminBooking } from "@/lib/admin-types"

const API = "https://dance-company-app.vercel.app"

const PACK_SESSION_PRICE = 99
const PRICE_POINTS = [
  { label: "Pack hour", revenue: 99 },
  { label: "30 min per-private", revenue: 65 },
  { label: "45 min per-private", revenue: 89 },
  { label: "60 min per-private", revenue: 119 },
]

function fmt(n: number) { return `$${n.toFixed(2)}` }

function statusBg(s: string) {
  const l = s.toLowerCase()
  if (l === "confirmed") return COLORS.primaryLight
  if (l.startsWith("cancelled")) return COLORS.redLight
  return COLORS.grayLight
}
function statusFg(s: string) {
  const l = s.toLowerCase()
  if (l === "confirmed") return COLORS.primary
  if (l.startsWith("cancelled")) return COLORS.red
  return COLORS.textMuted
}

export default function AdminPrepMastersScreen() {
  const { data, loading, refresh } = useAdmin()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<AdminWorker | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [localWorkers, setLocalWorkers] = useState<AdminWorker[] | null>(null)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setLocalWorkers(null)
    setRefreshing(false)
  }, [refresh])

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    )
  }

  const workers = localWorkers ?? data?.workers ?? []
  const bookings = data?.bookings ?? []

  const filtered = query.trim()
    ? workers.filter((w) => w.name.toLowerCase().includes(query.toLowerCase()) || w.email.toLowerCase().includes(query.toLowerCase()))
    : workers

  if (selected) {
    return (
      <PrepMasterProfile
        worker={selected}
        bookings={bookings.filter((b) => b.prepMasterName === selected.name)}
        onBack={() => setSelected(null)}
        onSaved={(updated) => {
          setSelected(updated)
          setLocalWorkers((prev) => (prev ?? workers).map((w) => w.id === updated.id ? updated : w))
        }}
      />
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.toolbar}>
        <View style={[styles.searchRow, { flex: 1 }]}>
          <Search size={16} color={COLORS.textMuted} style={{ marginRight: 6 }} />
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
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddForm(true)} activeOpacity={0.7}>
          <Plus size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(w) => w.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {workers.length === 0 ? "No Prep Masters yet." : "No Prep Masters match your search."}
          </Text>
        }
        renderItem={({ item: w }) => {
          const sessionCount = bookings.filter(
            (b) => b.prepMasterName === w.name && b.status.toLowerCase() !== "cancelled",
          ).length
          return (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(w)} activeOpacity={0.7}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(w.name || "?").slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{w.name}</Text>
                <Text style={styles.sub}>{w.email}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={styles.payRate}>${w.hourlyRate.toFixed(2)}/session</Text>
                <Text style={styles.sub}>{sessionCount} session{sessionCount !== 1 ? "s" : ""}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: w.active ? COLORS.greenLight : COLORS.grayLight }]}>
                <Text style={[styles.badgeText, { color: w.active ? COLORS.green : COLORS.textMuted }]}>
                  {w.active ? "Active" : "Inactive"}
                </Text>
              </View>
              <ChevronRight size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )
        }}
      />

      <Modal visible={showAddForm} animationType="slide" presentationStyle="pageSheet">
        <AddPrepMasterForm
          onClose={() => setShowAddForm(false)}
          onSuccess={(worker) => {
            setLocalWorkers([worker, ...workers])
            setShowAddForm(false)
          }}
        />
      </Modal>
    </SafeAreaView>
  )
}

function PrepMasterProfile({
  worker,
  bookings,
  onBack,
  onSaved,
}: {
  worker: AdminWorker
  bookings: AdminBooking[]
  onBack: () => void
  onSaved: (w: AdminWorker) => void
}) {
  const [name, setName] = useState(worker.name)
  const [email, setEmail] = useState(worker.email)
  const [phone, setPhone] = useState(worker.phone)
  const [address, setAddress] = useState(worker.address)
  const [hourlyRate, setHourlyRate] = useState(String(worker.hourlyRate))
  const [active, setActive] = useState(worker.active)
  const [saving, setSaving] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [filterMonth, setFilterMonth] = useState("")
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null)

  const completed = bookings.filter((b) => b.status.toLowerCase() !== "cancelled")
  const payPerSession = worker.hourlyRate
  const totalPay = payPerSession * completed.length
  const totalRevenue = PACK_SESSION_PRICE * completed.length
  const margin = totalRevenue - totalPay

  const months = Array.from(new Set(bookings.map((b) => b.date?.slice(0, 7)).filter(Boolean))).sort().reverse()
  const filteredBookings = filterMonth
    ? bookings.filter((b) => b.date?.startsWith(filterMonth))
    : bookings

  async function handleSave() {
    const rate = parseFloat(hourlyRate)
    if (Number.isNaN(rate) || rate < 0) { Alert.alert("Error", "Pay rate must be a valid number."); return }
    setSaving(true)
    const { error } = await authClient.$fetch(`${API}/api/admin/workers/${worker.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), address: address.trim(), hourlyRate: rate, active }),
      headers: { "Content-Type": "application/json" },
    })
    setSaving(false)
    if (error) { Alert.alert("Error", "Failed to update Prep Master."); return }
    onSaved({ ...worker, name: name.trim(), email: email.trim(), phone: phone.trim(), address: address.trim(), hourlyRate: rate, active })
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.profileBody}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={16} color={COLORS.primary} />
          <Text style={styles.backText}>All Prep Masters</Text>
        </TouchableOpacity>

        {/* Edit profile card */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.profileCardHeader} onPress={() => setInfoOpen((v) => !v)} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{worker.name}</Text>
              <Text style={styles.sub}>Edit profile, pay rate, and status</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: active ? COLORS.greenLight : COLORS.grayLight }]}>
              <Text style={[styles.badgeText, { color: active ? COLORS.green : COLORS.textMuted }]}>
                {active ? "Active" : "Inactive"}
              </Text>
            </View>
            {infoOpen ? <ChevronUp size={16} color={COLORS.textMuted} /> : <ChevronDown size={16} color={COLORS.textMuted} />}
          </TouchableOpacity>

          {infoOpen && (
            <View style={styles.editFields}>
              <EditField label="Full name" icon={<User size={13} color={COLORS.textMuted} />} value={name} onChange={setName} />
              <EditField label="Email" icon={<Mail size={13} color={COLORS.textMuted} />} value={email} onChange={setEmail} keyboardType="email-address" />
              <EditField label="Phone" icon={<Phone size={13} color={COLORS.textMuted} />} value={phone} onChange={setPhone} keyboardType="phone-pad" />
              <EditField label="Address" icon={<Home size={13} color={COLORS.textMuted} />} value={address} onChange={setAddress} />
              <EditField label="Pay rate per session ($)" icon={<DollarSign size={13} color={COLORS.textMuted} />} value={hourlyRate} onChange={setHourlyRate} keyboardType="decimal-pad" />

              <View style={styles.activeRow}>
                <Text style={styles.activeLabel}>Active — visible to dancers for booking</Text>
                <Switch
                  value={active}
                  onValueChange={setActive}
                  trackColor={{ true: COLORS.primary }}
                />
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, saving && styles.btnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={styles.btnPrimaryText}>{saving ? "Saving…" : "Save changes"}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Payroll summary */}
        {bookings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <DollarSign size={14} color={COLORS.textMuted} />
              <Text style={styles.sectionTitle}>Payroll</Text>
            </View>
            <View style={styles.statGrid}>
              <StatTile label="Pay rate / session" value={fmt(payPerSession)} />
              <StatTile label="Total sessions" value={String(completed.length)} />
              <StatTile label="Total pay owed" value={fmt(totalPay)} highlight />
              <StatTile label="Revenue (pack)" value={fmt(totalRevenue)} sub={`Margin ${fmt(margin)}`} />
            </View>
            <View style={styles.priceBreakdown}>
              <Text style={styles.breakdownTitle}>MARGIN BY SESSION TYPE</Text>
              <View style={styles.priceGrid}>
                {PRICE_POINTS.map(({ label, revenue }) => {
                  const m = revenue - payPerSession
                  return (
                    <View key={label} style={styles.pricePoint}>
                      <Text style={styles.pricePointLabel}>{label}</Text>
                      <Text style={styles.pricePointRevenue}>{fmt(revenue)} <Text style={styles.pricePointSub}>charged</Text></Text>
                      <Text style={[styles.pricePointMargin, { color: m < 0 ? COLORS.red : COLORS.green }]}>
                        {m < 0 ? "−" : "+"}{fmt(Math.abs(m))} margin
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>
          </View>
        )}

        {/* Booking history */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.collapseRow} onPress={() => setHistoryOpen((v) => !v)} activeOpacity={0.7}>
            <CalendarDays size={14} color={COLORS.textMuted} />
            <Text style={styles.sectionTitle}>Booking history ({bookings.length})</Text>
            {historyOpen ? <ChevronUp size={14} color={COLORS.textMuted} /> : <ChevronDown size={14} color={COLORS.textMuted} />}
          </TouchableOpacity>

          {historyOpen && (
            <>
              {/* Month filter */}
              {months.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <TouchableOpacity
                    style={[styles.filterChip, !filterMonth && styles.filterChipActive]}
                    onPress={() => setFilterMonth("")}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterChipText, !filterMonth && { color: COLORS.primary }]}>All</Text>
                  </TouchableOpacity>
                  {months.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.filterChip, filterMonth === m && styles.filterChipActive]}
                      onPress={() => setFilterMonth(m)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filterChipText, filterMonth === m && { color: COLORS.primary }]}>
                        {new Date(m + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {filteredBookings.length === 0
                ? <Text style={styles.empty}>No bookings match the selected filter.</Text>
                : filteredBookings.map((b) => {
                  const isOpen = expandedBooking === b.id
                  return (
                    <View key={b.id} style={styles.bookingCard}>
                      <TouchableOpacity
                        style={styles.bookingRow}
                        onPress={() => setExpandedBooking(isOpen ? null : b.id)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bookingName}>{b.dancerName || b.clientEmail || "Client"}</Text>
                          <Text style={styles.bookingMeta}>{b.date}{b.time ? ` · ${b.time}` : ""}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: statusBg(b.status) }]}>
                          <Text style={[styles.badgeText, { color: statusFg(b.status) }]}>{b.status}</Text>
                        </View>
                        {isOpen ? <ChevronUp size={12} color={COLORS.textMuted} /> : <ChevronDown size={12} color={COLORS.textMuted} />}
                      </TouchableOpacity>
                      {isOpen && (
                        <View style={styles.bookingDetail}>
                          <DetailGrid b={b} />
                          {b.notes ? (
                            <View style={styles.notesBox}>
                              <Text style={styles.notesLabel}>Notes</Text>
                              <Text style={styles.notesText}>{b.notes}</Text>
                            </View>
                          ) : (
                            <Text style={styles.noNotes}>No notes on this booking.</Text>
                          )}
                        </View>
                      )}
                    </View>
                  )
                })
              }
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function DetailGrid({ b }: { b: AdminBooking }) {
  return (
    <View style={styles.detailGrid}>
      <DetailCell label="Dancer" value={b.dancerName || "—"} />
      <DetailCell label="Email" value={b.clientEmail || "—"} />
      <DetailCell label="Date" value={b.date || "—"} />
      <DetailCell label="Time" value={b.time || "—"} />
      <DetailCell label="Status" value={b.status} />
    </View>
  )
}
function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailCell}>
      <Text style={styles.detailCellLabel}>{label}</Text>
      <Text style={styles.detailCellValue}>{value}</Text>
    </View>
  )
}

function EditField({ label, icon, value, onChange, keyboardType }: { label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; keyboardType?: any }) {
  return (
    <View style={styles.editField}>
      <View style={styles.editFieldLabel}>
        {icon}
        <Text style={styles.editFieldLabelText}>{label}</Text>
      </View>
      <TextInput
        style={styles.formInput}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        autoCapitalize="none"
        placeholderTextColor={COLORS.textMuted}
      />
    </View>
  )
}

function StatTile({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <View style={[styles.statTile, highlight && { borderColor: COLORS.primary + "40", backgroundColor: COLORS.primaryLight }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: COLORS.primary }]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  )
}

function AddPrepMasterForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: (w: AdminWorker) => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!name.trim()) { Alert.alert("Error", "Name is required."); return }
    if (!email.trim()) { Alert.alert("Error", "Email is required."); return }
    setSaving(true)
    const { data, error } = await authClient.$fetch(`${API}/api/admin/workers`, {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), hourlyRate: parseFloat(hourlyRate) || 0 }),
      headers: { "Content-Type": "application/json" },
    })
    setSaving(false)
    if (error || !data) { Alert.alert("Error", "Failed to add Prep Master."); return }
    onSuccess((data as any).worker)
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Add Prep Master</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8}><X size={22} color={COLORS.text} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.formBody}>
        <Text style={styles.formHint}>Creates a profile in Airtable and grants sign-in access. They'll see their portal when they log in with this email.</Text>
        <FormField label="Full name *" value={name} onChangeText={setName} placeholder="Jane Doe" />
        <FormField label="Email *" value={email} onChangeText={setEmail} placeholder="jane@example.com" keyboardType="email-address" />
        <FormField label="Phone" value={phone} onChangeText={setPhone} placeholder="(555) 000-0000" keyboardType="phone-pad" />
        <FormField label="Pay rate per session ($)" value={hourlyRate} onChangeText={setHourlyRate} placeholder="0.00" keyboardType="decimal-pad" />
        <TouchableOpacity style={[styles.btnPrimary, saving && styles.btnDisabled]} onPress={submit} disabled={saving} activeOpacity={0.7}>
          <Text style={styles.btnPrimaryText}>{saving ? "Adding…" : "Add Prep Master"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function FormField({ label, value, onChangeText, placeholder, keyboardType }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: any
}) {
  return (
    <View style={styles.formFieldWrap}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.formInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  toolbar: { flexDirection: "row", gap: SPACING.sm, margin: SPACING.md, alignItems: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.sm },
  searchInput: { flex: 1, height: 40, fontSize: 14, color: COLORS.text },
  addBtn: { backgroundColor: COLORS.primary, width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: SPACING.md, paddingBottom: 80 },
  empty: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.xl },
  card: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md },
  avatar: { width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  name: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  payRate: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: "600" },
  profileBody: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 80 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  backText: { fontSize: 14, fontWeight: "500", color: COLORS.primary },
  section: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, padding: SPACING.md, gap: SPACING.sm },
  profileCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  profileName: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text, flex: 1 },
  collapseRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  editFields: { gap: SPACING.sm, marginTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  editField: { gap: 4 },
  editFieldLabel: { flexDirection: "row", alignItems: "center", gap: 4 },
  editFieldLabelText: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted },
  formInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.background },
  activeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm },
  activeLabel: { fontSize: 14, fontWeight: "500", color: COLORS.text, flex: 1 },
  btnPrimary: { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: "center" },
  btnPrimaryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  btnDisabled: { opacity: 0.4 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  statTile: { flex: 1, minWidth: "45%", borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, backgroundColor: COLORS.background },
  statLabel: { fontSize: 11, color: COLORS.textMuted },
  statValue: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginTop: 2 },
  statSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  priceBreakdown: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, backgroundColor: COLORS.background },
  breakdownTitle: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: SPACING.sm },
  priceGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
  pricePoint: { flex: 1, minWidth: "40%" },
  pricePointLabel: { fontSize: 11, color: COLORS.textMuted },
  pricePointRevenue: { fontSize: 14, fontWeight: "600", color: COLORS.text, marginTop: 1 },
  pricePointSub: { fontSize: 11, fontWeight: "400", color: COLORS.textMuted },
  pricePointMargin: { fontSize: 12, fontWeight: "500", marginTop: 1 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, marginRight: 6, backgroundColor: COLORS.background },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  filterChipText: { fontSize: 12, fontWeight: "500", color: COLORS.textMuted },
  bookingCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, overflow: "hidden", marginBottom: 6, backgroundColor: COLORS.background },
  bookingRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm },
  bookingName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  bookingMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  bookingDetail: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.sm, gap: SPACING.sm, backgroundColor: COLORS.surface },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  detailCell: { flex: 1, minWidth: "40%" },
  detailCellLabel: { fontSize: 10, color: COLORS.textMuted },
  detailCellValue: { fontSize: 13, fontWeight: "500", color: COLORS.text, marginTop: 1 },
  notesBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, backgroundColor: COLORS.background },
  notesLabel: { fontSize: 10, color: COLORS.textMuted },
  notesText: { fontSize: 13, color: COLORS.text, marginTop: 2 },
  noNotes: { fontSize: 11, color: COLORS.textMuted, fontStyle: "italic" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  formBody: { padding: SPACING.md, gap: SPACING.md },
  formHint: { fontSize: 13, color: COLORS.textMuted },
  formFieldWrap: { gap: 4 },
  formLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
})
