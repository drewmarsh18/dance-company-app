import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { X, CalendarClock, Calendar, Clock, Package, StickyNote } from "lucide-react-native"
import { authClient } from "@/lib/auth-client"
import { SPACING, RADIUS } from "@/constants/theme"
import { useColors } from "@/lib/theme-context"

const API_BASE = "https://dance-company-app.vercel.app"

export type Booking = {
  id: string
  prepMasterName: string
  date: string
  time: string
  status: string
  sessionType: string | null
  notes?: string
}

export function formatDate(dateStr: string) {
  if (!dateStr) return ""
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export function formatTime(timeStr: string) {
  if (!timeStr) return ""
  if (/am|pm/i.test(timeStr)) return timeStr
  const [h, m] = timeStr.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return timeStr
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}

export function BookingDetailModal({
  booking,
  onClose,
  onCancelled,
  onRescheduled,
  onRefresh,
}: {
  booking: Booking | null
  onClose: () => void
  onCancelled: (id: string) => void
  onRescheduled: (id: string, date: string, time: string) => void
  onRefresh?: () => Promise<void>
}) {
  const COLORS = useColors()
  const styles = makeStyles(COLORS)
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel-reason">("view")
  const [editDate, setEditDate] = useState("")
  const [editTime, setEditTime] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (booking) {
      setEditDate(booking.date)
      setEditTime(booking.time)
      setEditNotes(booking.notes ?? "")
      setMode("view")
    }
  }, [booking])

  if (!booking) return null

  const isCancelled = booking.status.toLowerCase().startsWith("cancelled")
  const sc = booking.status.toLowerCase() === "confirmed"
    ? { bg: COLORS.primaryLight, text: COLORS.primary }
    : isCancelled
    ? { bg: COLORS.redLight, text: COLORS.red }
    : { bg: COLORS.grayLight, text: COLORS.textMuted }

  function isWithin24Hours() {
    if (!booking.date) return false
    const sessionDate = new Date(`${booking.date}T${booking.time && !/am|pm/i.test(booking.time) ? booking.time : "12:00"}`)
    return (sessionDate.getTime() - Date.now()) < 24 * 60 * 60 * 1000
  }

  async function handleCancel() {
    const within24 = isWithin24Hours()
    Alert.alert(
      "Cancel booking",
      within24
        ? "This session is within 24 hours. If canceled, your credit will not be refunded."
        : "Your session credit will be returned to your account.",
      [
        { text: "Keep booking", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            setCancelReason("")
            setMode("cancel-reason")
          },
        },
      ]
    )
  }

  async function submitCancel() {
    if (!cancelReason.trim()) { Alert.alert("Required", "Please enter a reason for cancellation."); return }
    setLoading(true)
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/member/bookings/${booking.id}`, {
        method: "DELETE",
        body: { reason: cancelReason.trim() },
      })
      if ((data as any)?.ok) { onCancelled(booking.id); onClose(); onRefresh?.() }
      else Alert.alert("Error", (data as any)?.error ?? (error as any)?.message ?? "Failed to cancel booking.")
    } catch { Alert.alert("Error", "Failed to cancel booking.") }
    finally { setLoading(false) }
  }

  async function handleReschedule() {
    if (!editDate || !editTime) { Alert.alert("Missing info", "Please enter both a date and time."); return }
    setLoading(true)
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/member/bookings/${booking.id}`, {
        method: "PATCH",
        body: { date: editDate, time: editTime, notes: editNotes },
      })
      if ((data as any)?.ok) { onRescheduled(booking.id, editDate, editTime); onClose(); onRefresh?.() }
      else Alert.alert("Error", (data as any)?.error ?? (error as any)?.message ?? "Failed to reschedule.")
    } catch { Alert.alert("Error", "Failed to reschedule.") }
    finally { setLoading(false) }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={["top"]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{mode === "reschedule" ? "Reschedule" : mode === "cancel-reason" ? "Cancel booking" : "Session details"}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}><X size={22} color={COLORS.text} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalScroll}>
          {mode === "cancel-reason" ? (
            <>
              <Text style={styles.rescheduleNote}>Please let us know why you're cancelling this session. This helps your Prep Master prepare.</Text>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Cancellation reason</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  placeholder="e.g. Scheduling conflict, not feeling well…"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={4}
                  autoFocus
                />
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={submitCancel} activeOpacity={0.7} disabled={loading}>
                  <Text style={styles.cancelBtnText}>{loading ? "Cancelling…" : "Confirm cancellation"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => setMode("view")} activeOpacity={0.7}>
                  <Text style={styles.ghostBtnText}>Go back</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : mode === "view" ? (
            <>
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <CalendarClock size={15} color={COLORS.primary} />
                  <Text style={styles.detailLabel}>Prep Master</Text>
                  <Text style={styles.detailValue}>{booking.prepMasterName || "—"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Calendar size={15} color={COLORS.textMuted} />
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{formatDate(booking.date)}</Text>
                </View>
                {booking.time ? (
                  <View style={styles.detailRow}>
                    <Clock size={15} color={COLORS.textMuted} />
                    <Text style={styles.detailLabel}>Time</Text>
                    <Text style={styles.detailValue}>{formatTime(booking.time)}</Text>
                  </View>
                ) : null}
                {booking.sessionType ? (
                  <View style={styles.detailRow}>
                    <Package size={15} color={COLORS.textMuted} />
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={styles.detailValue}>{booking.sessionType}</Text>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <View style={[styles.statusDot, { backgroundColor: sc.bg }]} />
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.text }]}>{booking.status}</Text>
                  </View>
                </View>
                {booking.notes ? (
                  <View style={[styles.detailRow, { alignItems: "flex-start" }]}>
                    <StickyNote size={15} color={COLORS.textMuted} style={{ marginTop: 2 }} />
                    <Text style={styles.detailLabel}>Notes</Text>
                    <Text style={[styles.detailValue, { flex: 1 }]}>{booking.notes}</Text>
                  </View>
                ) : null}
              </View>
              {!isCancelled && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.rescheduleBtn} onPress={() => setMode("reschedule")} activeOpacity={0.7}>
                    <Text style={styles.rescheduleBtnText}>Reschedule</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.7} disabled={loading}>
                    <Text style={styles.cancelBtnText}>{loading ? "Cancelling…" : "Cancel booking"}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.rescheduleNote}>Enter a new date and time. The booking will be reset to Pending until your Prep Master confirms.</Text>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>New date (YYYY-MM-DD)</Text>
                <TextInput style={styles.formInput} value={editDate} onChangeText={setEditDate} placeholder="2026-07-15" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>New time (e.g. 3:00 PM)</Text>
                <TextInput style={styles.formInput} value={editTime} onChangeText={setEditTime} placeholder="3:00 PM" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes (optional)</Text>
                <TextInput style={[styles.formInput, styles.formTextarea]} value={editNotes} onChangeText={setEditNotes} placeholder="Any notes for your session…" placeholderTextColor={COLORS.textMuted} multiline numberOfLines={3} />
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.rescheduleBtn} onPress={handleReschedule} activeOpacity={0.7} disabled={loading}>
                  <Text style={styles.rescheduleBtnText}>{loading ? "Saving…" : "Save changes"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => setMode("view")} activeOpacity={0.7}>
                  <Text style={styles.ghostBtnText}>Back</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function makeStyles(COLORS: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    modalSafe: { flex: 1, backgroundColor: COLORS.background },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    modalTitle: { fontSize: 17, fontWeight: "600", color: COLORS.text },
    modalScroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
    detailCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
    detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    detailLabel: { fontSize: 13, color: COLORS.textMuted, width: 70 },
    detailValue: { fontSize: 13, fontWeight: "500", color: COLORS.text },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
    statusText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
    actionButtons: { gap: SPACING.sm },
    rescheduleBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: "center" },
    rescheduleBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    cancelBtn: { backgroundColor: COLORS.redLight, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: "center" },
    cancelBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.red },
    ghostBtn: { borderRadius: RADIUS.md, padding: SPACING.md, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
    ghostBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.text },
    rescheduleNote: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
    formGroup: { gap: 6 },
    formLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
    formInput: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, fontSize: 14, color: COLORS.text },
    formTextarea: { minHeight: 80, textAlignVertical: "top" },
  })
}
