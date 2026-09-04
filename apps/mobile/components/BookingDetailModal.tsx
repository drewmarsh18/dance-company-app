import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { X, CalendarClock, Calendar, Clock, Package, StickyNote, ChevronLeft, ChevronRight } from "lucide-react-native"
import { TimeWheelPicker, generate15MinSlots } from "@/components/TimeWheelPicker"
import { authClient } from "@/lib/auth-client"
import { SPACING, RADIUS } from "@/constants/theme"
import { useColors } from "@/lib/theme-context"

const API_BASE = "https://dance-company-app.vercel.app"

export type Booking = {
  id: string
  prepMasterName: string
  date: string
  time: string
  utcDatetime?: string | null
  status: string
  sessionType: string | null
  notes?: string
  prepMasterNotes?: string
}

/** Converts a stored ET date + 12-hour time to a UTC ISO string for local display. */
function etToUtcIso(date: string, timeStr: string): string | null {
  const match = timeStr.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i)
  if (!match) return null
  let h = parseInt(match[1])
  const m = match[2] ? parseInt(match[2]) : 0
  if (match[3].toUpperCase() === "PM" && h !== 12) h += 12
  if (match[3].toUpperCase() === "AM" && h === 12) h = 0
  const [year, mo, day] = date.split("-").map(Number)
  const seed = new Date(Date.UTC(year, mo - 1, day, h + 5, m))
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(seed)
  const etH = parseInt(parts.find((p) => p.type === "hour")!.value)
  const etM = parseInt(parts.find((p) => p.type === "minute")!.value)
  const diffMs = ((etH * 60 + etM) - (h * 60 + m)) * 60_000
  return new Date(seed.getTime() - diffMs).toISOString()
}

export function formatDate(dateStr: string) {
  if (!dateStr) return ""
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}

// When utcDatetime is present, convert to the viewer's local time and append their tz abbreviation.
// Falls back to the stored ET time string with "ET" label for older bookings.
export function formatTime(timeStr: string, utcDatetime?: string | null) {
  if (utcDatetime) {
    const d = new Date(utcDatetime)
    if (!isNaN(d.getTime())) {
      const formatted = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      const tzAbbr = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value ?? ""
      return tzAbbr ? `${formatted} ${tzAbbr}` : formatted
    }
  }
  if (!timeStr) return ""
  const clean = timeStr.replace(/\s+(EST|EDT|CST|CDT|MST|MDT|PST|PDT|[A-Z]{3,5})$/, "").trim()
  return `${clean} ET`
}

// --- Availability helpers (mirrors apps/web/lib/availability.ts) ---
type DayAvailability = { dayOfWeek: number; enabled: boolean; startTime: string; endTime: string }

function slotsForDate(dateIso: string, week: DayAvailability[]): string[] {
  const day = new Date(`${dateIso}T00:00:00`).getDay()
  const config = week.find((w) => w.dayOfWeek === day)
  if (!config || !config.enabled) return []
  return generate15MinSlots(config.startTime, config.endTime)
}
// ---

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

function MiniCalendar({
  selectedDate, onSelect, year, month, onPrev, onNext, COLORS, styles,
}: {
  selectedDate: string; onSelect: (d: string) => void
  year: number; month: number; onPrev: () => void; onNext: () => void
  COLORS: any; styles: any
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  function pad2(n: number) { return String(n).padStart(2, "0") }

  return (
    <View style={styles.calendarWrap}>
      <View style={styles.calNavRow}>
        <TouchableOpacity onPress={onPrev} hitSlop={8} style={styles.calNavBtn}>
          <ChevronLeft size={18} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.calMonthLabel}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity onPress={onNext} hitSlop={8} style={styles.calNavBtn}>
          <ChevronRight size={18} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.calGrid}>
        {WEEK_DAYS.map((wd) => (
          <View key={wd} style={styles.calDayHeader}>
            <Text style={styles.calDayHeaderText}>{wd}</Text>
          </View>
        ))}
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={styles.calCell} />
          const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`
          const cellDate = new Date(year, month, day)
          const isPast = cellDate < today
          const isSelected = dateStr === selectedDate
          const isToday = cellDate.getTime() === today.getTime()
          return (
            <TouchableOpacity
              key={dateStr}
              style={[styles.calCell, isSelected && styles.calCellSelected, isToday && !isSelected && styles.calCellToday]}
              onPress={() => !isPast && onSelect(dateStr)}
              activeOpacity={isPast ? 1 : 0.7}
              disabled={isPast}
            >
              <Text style={[styles.calCellText, isPast && styles.calCellPast, isSelected && styles.calCellTextSelected]}>
                {day}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}


export function BookingDetailModal({
  booking, onClose, onCancelled, onRescheduled, onRefresh,
}: {
  booking: Booking | null
  onClose: () => void
  onCancelled: (id: string) => void
  onRescheduled: (id: string, date: string, time: string, utcDatetime?: string | null) => void
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
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [availWeek, setAvailWeek] = useState<DayAvailability[]>([])
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({})
  const [availLoading, setAvailLoading] = useState(false)

  useEffect(() => {
    if (booking) {
      setEditDate(booking.date)
      setEditTime(booking.time && /am|pm/i.test(booking.time) ? booking.time : formatTime(booking.time))
      setEditNotes(booking.notes ?? "")
      setMode("view")
      setAvailWeek([])
      setBookedSlots({})
      if (booking.date) {
        const d = new Date(`${booking.date}T00:00:00`)
        if (!isNaN(d.getTime())) { setCalYear(d.getFullYear()); setCalMonth(d.getMonth()) }
      }
    }
  }, [booking])

  // Fetch PrepMaster availability when entering reschedule mode
  async function loadAvailability() {
    if (!booking?.prepMasterName || availWeek.length > 0) return
    setAvailLoading(true)
    try {
      const { data: coachesData } = await authClient.$fetch(`${API_BASE}/api/booking/coaches`)
      const coaches = (coachesData as any)?.coaches ?? []
      const coach = coaches.find((c: any) =>
        c.name?.toLowerCase() === booking.prepMasterName.toLowerCase()
      )
      if (!coach?.id) return
      const { data: detail } = await authClient.$fetch(`${API_BASE}/api/booking/coaches/${coach.id}`)
      if (detail) {
        setAvailWeek((detail as any).week ?? [])
        setBookedSlots((detail as any).bookedSlots ?? {})
      }
    } catch { /* availability unavailable — dropdown will show generic message */ }
    finally { setAvailLoading(false) }
  }

  function enterReschedule() {
    setMode("reschedule")
    loadAvailability()
  }

  // Compute available time slots for the selected date
  const availableSlots: string[] = editDate && availWeek.length > 0
    ? slotsForDate(editDate, availWeek).filter((s) => {
        const taken = bookedSlots[editDate] ?? []
        // Exclude currently-booked slot only if it's a different booking (allow keeping same time)
        return !taken.includes(s) || (booking?.date === editDate && booking?.time === s)
      })
    : []

  if (!booking) return null

  const isCancelled = booking.status.toLowerCase().startsWith("cancelled") || booking.status.toLowerCase() === "declined"
  const sc = booking.status.toLowerCase() === "confirmed"
    ? { bg: COLORS.primaryLight, text: COLORS.primary }
    : booking.status.toLowerCase() === "declined"
    ? { bg: COLORS.amberLight, text: COLORS.amber }
    : isCancelled
    ? { bg: COLORS.redLight, text: COLORS.red }
    : { bg: COLORS.grayLight, text: COLORS.textMuted }

  function isWithin24Hours() {
    if (!booking.date) return false
    const sessionDate = new Date(`${booking.date}T${booking.time && !/am|pm/i.test(booking.time) ? booking.time : "12:00"}`)
    return (sessionDate.getTime() - Date.now()) < 24 * 60 * 60 * 1000
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  async function handleCancel() {
    Alert.alert(
      "Cancel booking",
      isWithin24Hours()
        ? "This session is within 24 hours. If canceled, your credit will not be refunded."
        : "Your session credit will be returned to your account.",
      [
        { text: "Keep booking", style: "cancel" },
        { text: "Continue", style: "destructive", onPress: () => { setCancelReason(""); setMode("cancel-reason") } },
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
    if (!editDate || !editTime) { Alert.alert("Missing info", "Please choose both a date and time."); return }
    setLoading(true)
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/member/bookings/${booking.id}`, {
        method: "PATCH",
        body: { date: editDate, time: editTime, notes: editNotes },
      })
      if ((data as any)?.ok) { Alert.alert("Request sent", "Your reschedule request is awaiting approval from your PrepMaster."); onRescheduled(booking.id, editDate, editTime, etToUtcIso(editDate, editTime)); onClose(); onRefresh?.() }
      else Alert.alert("Error", (data as any)?.error ?? (error as any)?.message ?? "Failed to reschedule.")
    } catch { Alert.alert("Error", "Failed to reschedule.") }
    finally { setLoading(false) }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={["top"]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {mode === "reschedule" ? "Reschedule" : mode === "cancel-reason" ? "Cancel booking" : "Session details"}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}><X size={22} color={COLORS.text} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalScroll}>
          {mode === "cancel-reason" ? (
            <>
              <Text style={styles.rescheduleNote}>Please let us know why you're cancelling this session. This helps your PrepMaster prepare.</Text>
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
                  <Text style={styles.detailLabel}>PrepMaster</Text>
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
                    <Text style={styles.detailValue}>{formatTime(booking.time, booking.utcDatetime)}</Text>
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
                    <Text style={styles.detailLabel}>My notes</Text>
                    <Text style={[styles.detailValue, { flex: 1 }]}>{booking.notes}</Text>
                  </View>
                ) : null}
                {booking.prepMasterNotes ? (
                  <View style={[styles.detailRow, { alignItems: "flex-start" }]}>
                    <StickyNote size={15} color={COLORS.primary} style={{ marginTop: 2 }} />
                    <Text style={styles.detailLabel}>PM notes</Text>
                    <Text style={[styles.detailValue, { flex: 1 }]}>{booking.prepMasterNotes}</Text>
                  </View>
                ) : null}
              </View>
              {!isCancelled && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.rescheduleBtn} onPress={enterReschedule} activeOpacity={0.7}>
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
              <Text style={styles.rescheduleNote}>
                Pick a new date and time. Times shown reflect {booking.prepMasterName}'s availability. The booking will reset to Pending until they confirm.
              </Text>

              <View style={styles.formGroup}>
                <View style={styles.pickerLabelRow}>
                  <Calendar size={14} color={COLORS.primary} />
                  <Text style={styles.formLabel}>Date</Text>
                  {editDate ? <Text style={styles.pickerSelected}>{formatDate(editDate)}</Text> : null}
                </View>
                <MiniCalendar
                  selectedDate={editDate}
                  onSelect={(d) => { setEditDate(d); setEditTime("") }}
                  year={calYear}
                  month={calMonth}
                  onPrev={prevMonth}
                  onNext={nextMonth}
                  COLORS={COLORS}
                  styles={styles}
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.pickerLabelRow}>
                  <Clock size={14} color={COLORS.primary} />
                  <Text style={styles.formLabel}>Time</Text>
                </View>
                {availLoading ? (
                  <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
                ) : !editDate ? (
                  <Text style={styles.noSlotsNote}>Select a date first.</Text>
                ) : availableSlots.length === 0 ? (
                  <Text style={styles.noSlotsNote}>{booking.prepMasterName} has no availability on this day. Please pick a different date.</Text>
                ) : (
                  <TimeWheelPicker
                    slots={availableSlots}
                    value={editTime}
                    onChange={setEditTime}
                  />
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Any notes for your session…"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.rescheduleBtn, (!editDate || !editTime) && { opacity: 0.5 }]}
                  onPress={handleReschedule}
                  activeOpacity={0.7}
                  disabled={loading || !editDate || !editTime}
                >
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
    noSlotsNote: { fontSize: 12, color: COLORS.amber, lineHeight: 17 },
    formGroup: { gap: 8 },
    formLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
    formInput: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, fontSize: 14, color: COLORS.text },
    formTextarea: { minHeight: 80, textAlignVertical: "top" },
    pickerLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    pickerSelected: { fontSize: 13, color: COLORS.primary, fontWeight: "600", marginLeft: 4 },
    // Calendar
    calendarWrap: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm },
    calNavRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    calNavBtn: { padding: 4 },
    calMonthLabel: { fontSize: 14, fontWeight: "700", color: COLORS.text },
    calGrid: { flexDirection: "row", flexWrap: "wrap" },
    calDayHeader: { width: "14.285714%", alignItems: "center", paddingVertical: 4 },
    calDayHeaderText: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted },
    calCell: { width: "14.285714%", alignItems: "center", paddingVertical: 6 },
    calCellSelected: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full },
    calCellToday: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.primary },
    calCellText: { fontSize: 13, color: COLORS.text, fontWeight: "500" },
    calCellPast: { color: COLORS.textMuted, opacity: 0.4 },
    calCellTextSelected: { color: "#fff", fontWeight: "700" },
    // Dropdown
  })
}
