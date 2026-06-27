import { useEffect, useState, useCallback } from "react"
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import {
  CalendarDays, Clock, Mail, Phone, StickyNote,
  Check, X, Pencil, ChevronDown, ChevronUp,
} from "lucide-react-native"
import { authClient, useSession } from "@/lib/auth-client"
import { SPACING, RADIUS } from "@/constants/theme"
import { useColors } from "@/lib/theme-context"

const API_BASE = "https://dance-company-app.vercel.app"

type PrepMasterBooking = {
  id: string; date: string; time: string; status: string; notes: string
  dancerName: string; dancerEmail: string; dancerPhone: string; userId: string
}

type DashData = {
  prepMaster: { id: string; name: string; email: string }
  upcoming: PrepMasterBooking[]; completed: PrepMasterBooking[]; cancelled: PrepMasterBooking[]
}

function formatDate(date: string) {
  if (!date) return "Date TBD"
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
}

function BookingCard({ booking, dimmed, onUpdate }: {
  booking: PrepMasterBooking; dimmed?: boolean; onUpdate: (id: string, patch: Partial<PrepMasterBooking>) => void
}) {
  const COLORS = useColors()
  const styles = makeStyles(COLORS)
  const [status, setStatus] = useState(booking.status)
  const [localDate, setLocalDate] = useState(booking.date)
  const [localTime, setLocalTime] = useState(booking.time)
  const [localNotes, setLocalNotes] = useState(booking.notes)
  const [editDate, setEditDate] = useState(booking.date)
  const [editTime, setEditTime] = useState(booking.time)
  const [editNotes, setEditNotes] = useState(booking.notes)
  const [mode, setMode] = useState<"idle" | "edit" | "decline-reason">("idle")
  const [declineReason, setDeclineReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const isPending = status.toLowerCase() === "pending"
  const isCancelled = status.toLowerCase().startsWith("cancelled") || status.toLowerCase() === "declined"
  const s = status.toLowerCase()
  const sc = s === "confirmed" ? { bg: COLORS.primaryLight, text: COLORS.primary }
    : s === "declined" ? { bg: COLORS.amberLight, text: COLORS.amber }
    : s.startsWith("cancelled") ? { bg: COLORS.redLight, text: COLORS.red }
    : s === "pending" ? { bg: COLORS.amberLight, text: COLORS.amber }
    : { bg: COLORS.grayLight, text: COLORS.textMuted }

  async function callAction(action: "confirm" | "decline" | "edit", reason?: string) {
    setSaving(true)
    try {
      const body: Record<string, unknown> = action === "edit"
        ? { date: editDate, time: editTime, notes: editNotes }
        : action === "decline"
        ? { action, declineReason: reason }
        : { action }
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/portal/bookings/${booking.id}`,
        { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } })
      if (error) throw new Error((error as any)?.message ?? "Failed")
      const res = data as { ok: boolean; error?: string }
      if (!res.ok) throw new Error(res.error ?? "Failed")
      if (action === "confirm") { setStatus("Confirmed"); onUpdate(booking.id, { status: "Confirmed" }) }
      if (action === "decline") { setStatus("Declined"); onUpdate(booking.id, { status: "Declined" }); setMode("idle") }
      if (action === "edit") {
        setLocalDate(editDate); setLocalTime(editTime); setLocalNotes(editNotes)
        onUpdate(booking.id, { date: editDate, time: editTime, notes: editNotes })
        setMode("idle")
      }
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong.") }
    finally { setSaving(false) }
  }

  return (
    <View style={[styles.card, isPending && styles.cardPending, dimmed && { opacity: 0.7 }]}>
      <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.cardDateRow}>
            <CalendarDays size={14} color={COLORS.primary} />
            <Text style={styles.cardDate}>{formatDate(localDate)}</Text>
            {localTime ? <><Clock size={13} color={COLORS.textMuted} /><Text style={styles.cardTime}>{localTime}</Text></> : null}
          </View>
          <Text style={styles.cardDancer}>{booking.dancerName || "Dancer"}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}><Text style={[styles.badgeText, { color: sc.text }]}>{status}</Text></View>
          {expanded ? <ChevronUp size={16} color={COLORS.textMuted} /> : <ChevronDown size={16} color={COLORS.textMuted} />}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.cardBody}>
          {(booking.dancerEmail || booking.dancerPhone) && (
            <View style={{ gap: 4 }}>
              {booking.dancerEmail && <View style={styles.infoRow}><Mail size={13} color={COLORS.textMuted} /><Text style={styles.infoText}>{booking.dancerEmail}</Text></View>}
              {booking.dancerPhone && <View style={styles.infoRow}><Phone size={13} color={COLORS.textMuted} /><Text style={styles.infoText}>{booking.dancerPhone}</Text></View>}
            </View>
          )}
          {localNotes && mode === "idle" && <View style={styles.infoRow}><StickyNote size={13} color={COLORS.textMuted} /><Text style={styles.infoText}>{localNotes}</Text></View>}

          {mode === "idle" && !isCancelled && (
            <View style={styles.actionRow}>
              {isPending && (
                <>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary, saving && { opacity: 0.5 }]} onPress={() => callAction("confirm")} disabled={saving} activeOpacity={0.8}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <><Check size={14} color="#fff" /><Text style={styles.actionBtnPrimaryText}>Confirm</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger, saving && { opacity: 0.5 }]}
                    onPress={() => { setDeclineReason(""); setMode("decline-reason") }}
                    disabled={saving} activeOpacity={0.8}>
                    <X size={14} color={COLORS.red} /><Text style={styles.actionBtnDangerText}>Decline</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGhost]} onPress={() => setMode("edit")} activeOpacity={0.8}>
                <Pencil size={14} color={COLORS.textMuted} /><Text style={styles.actionBtnGhostText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === "decline-reason" && (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={styles.editPanel}>
                <Text style={styles.editPanelTitle}>Reason for declining</Text>
                <TextInput
                  style={[styles.editInput, { minHeight: 72, textAlignVertical: "top" }]}
                  value={declineReason}
                  onChangeText={setDeclineReason}
                  placeholder="e.g. Scheduling conflict, unavailable that day…"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  autoFocus
                />
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDanger, saving && { opacity: 0.5 }]}
                    onPress={() => {
                      if (!declineReason.trim()) { Alert.alert("Required", "Please enter a reason for declining."); return }
                      callAction("decline", declineReason.trim())
                    }}
                    disabled={saving} activeOpacity={0.8}>
                    {saving ? <ActivityIndicator size="small" color={COLORS.red} /> : <><X size={14} color={COLORS.red} /><Text style={styles.actionBtnDangerText}>Confirm decline</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGhost]} onPress={() => setMode("idle")} activeOpacity={0.8}>
                    <Text style={styles.actionBtnGhostText}>Go back</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}

          {mode === "edit" && (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={styles.editPanel}>
                <Text style={styles.editPanelTitle}>Edit booking</Text>
                <View style={styles.editRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editLabel}>Date</Text>
                    <TextInput style={styles.editInput} value={editDate} onChangeText={setEditDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editLabel}>Time</Text>
                    <TextInput style={styles.editInput} value={editTime} onChangeText={setEditTime} placeholder="e.g. 3:00 PM" placeholderTextColor={COLORS.textMuted} />
                  </View>
                </View>
                <Text style={styles.editLabel}>Notes</Text>
                <TextInput style={[styles.editInput, { minHeight: 64, textAlignVertical: "top" }]} value={editNotes} onChangeText={setEditNotes} placeholder="Session notes…" placeholderTextColor={COLORS.textMuted} multiline />
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary, saving && { opacity: 0.5 }]} onPress={() => callAction("edit")} disabled={saving} activeOpacity={0.8}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionBtnPrimaryText}>Save changes</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGhost]} onPress={() => { setEditDate(localDate); setEditTime(localTime); setEditNotes(localNotes); setMode("idle") }} activeOpacity={0.8}>
                    <Text style={styles.actionBtnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      )}
    </View>
  )
}

export default function PortalDashboard() {
  const { data: session } = useSession()
  const COLORS = useColors()
  const firstName = session?.user?.name?.split(" ")[0] ?? "there"
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { data: result, error: err } = await authClient.$fetch(`${API_BASE}/api/portal/dashboard`)
      if (err || !result) throw new Error((err as any)?.statusText ?? "Failed to load")
      setData(result as DashData); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong.") }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false) }, [load])

  function handleUpdate(id: string, patch: Partial<PrepMasterBooking>) {
    setData((prev) => {
      if (!prev) return prev
      const patchList = (list: PrepMasterBooking[]) => list.map((b) => b.id === id ? { ...b, ...patch } : b)
      return { ...prev, upcoming: patchList(prev.upcoming), completed: patchList(prev.completed), cancelled: patchList(prev.cancelled) }
    })
  }

  const styles = makeStyles(COLORS)

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={["top"]}><View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View></SafeAreaView>
  }

  const pendingCount = (data?.upcoming ?? []).filter((b) => b.status.toLowerCase() === "pending").length

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Welcome, {firstName}</Text>
            <Text style={styles.pageSub}>Confirm or decline any pending requests.</Text>
          </View>
          {pendingCount > 0 && <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{pendingCount} pending</Text></View>}
        </View>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming sessions</Text>
          {(data?.upcoming ?? []).length === 0 ? (
            <View style={styles.emptyCard}><Text style={styles.emptyText}>No upcoming sessions booked yet.</Text></View>
          ) : (data?.upcoming ?? []).map((b) => <BookingCard key={b.id} booking={b} onUpdate={handleUpdate} />)}
        </View>
        {(data?.completed ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.textMuted }]}>Completed sessions</Text>
            {(data?.completed ?? []).map((b) => <BookingCard key={b.id} booking={b} dimmed onUpdate={handleUpdate} />)}
          </View>
        )}
        {(data?.cancelled ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.textMuted }]}>Cancelled & Declined sessions</Text>
            {(data?.cancelled ?? []).map((b) => <BookingCard key={b.id} booking={b} dimmed onUpdate={handleUpdate} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(COLORS: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    scroll: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xl },
    pageHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: SPACING.sm },
    pageTitle: { fontSize: 26, fontWeight: "700", color: COLORS.text },
    pageSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
    pendingBadge: { backgroundColor: COLORS.red, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
    pendingBadgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },
    errorBox: { backgroundColor: COLORS.redLight, borderRadius: RADIUS.sm, padding: SPACING.sm },
    errorText: { fontSize: 13, color: COLORS.red },
    section: { gap: SPACING.sm },
    sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
    emptyCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, alignItems: "center" },
    emptyText: { fontSize: 14, color: COLORS.textMuted },
    card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
    cardPending: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
    cardHeader: { flexDirection: "row", alignItems: "center", padding: SPACING.md, gap: SPACING.sm },
    cardDateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    cardDate: { fontSize: 13, fontWeight: "600", color: COLORS.text },
    cardTime: { fontSize: 12, color: COLORS.textMuted },
    cardDancer: { fontSize: 15, fontWeight: "700", color: COLORS.text },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
    badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
    cardBody: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
    infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    infoText: { fontSize: 13, color: COLORS.textMuted, flex: 1 },
    actionRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: 4 },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
    actionBtnPrimary: { backgroundColor: COLORS.primary },
    actionBtnPrimaryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    actionBtnDanger: { borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redLight },
    actionBtnDangerText: { fontSize: 13, fontWeight: "700", color: COLORS.red },
    actionBtnGhost: { borderWidth: 1, borderColor: COLORS.border },
    actionBtnGhostText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
    editPanel: { gap: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
    editPanelTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text },
    editRow: { flexDirection: "row", gap: SPACING.sm },
    editLabel: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
    editInput: { backgroundColor: COLORS.background, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.sm, paddingVertical: 8, fontSize: 14, color: COLORS.text },
  })
}
