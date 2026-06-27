import { useEffect, useState, useCallback, useMemo } from "react"
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { ChevronLeft, ChevronRight, Check, Users, CalendarOff } from "lucide-react-native"
import { authClient, useSession } from "@/lib/auth-client"
import { SPACING, RADIUS } from "@/constants/theme"
import { useColors } from "@/lib/theme-context"
import { getUniversityColor } from "@/lib/university-colors"

const API_BASE = "https://dance-company-app.vercel.app"

type Coach = { id: string; name: string; email: string; university: string; region: string; hasAvailability: boolean }
type DayAvailability = { dayOfWeek: number; enabled: boolean; startTime: string; endTime: string }
type MemberPlan = { id: string; planName: string; sessions: number; status: string; expiresAt: string }
type CoachDetail = { coach: Coach; week: DayAvailability[]; bookedSlots: Record<string, string[]> }

function toIso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
function weekStart(date: Date): Date { const d = new Date(date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d }
function buildWeekDays(sunday: Date): Date[] { return Array.from({ length: 7 }, (_, i) => { const d = new Date(sunday); d.setDate(sunday.getDate() + i); return d }) }
function to12Hour(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":")
  let h = Number(hStr); const m = mStr ?? "00"
  const period = h >= 12 ? "PM" : "AM"
  if (h === 0) h = 12; else if (h > 12) h -= 12
  return `${h}:${m} ${period}`
}
function slotsForDate(dateIso: string, week: DayAvailability[]): string[] {
  const day = new Date(`${dateIso}T00:00:00`).getDay()
  const config = week.find((w) => w.dayOfWeek === day)
  if (!config || !config.enabled) return []
  const start = Number(config.startTime.split(":")[0]); const end = Number(config.endTime.split(":")[0])
  const slots: string[] = []
  for (let h = start; h < end; h++) slots.push(to12Hour(`${String(h).padStart(2, "0")}:00`))
  return slots
}
function planDisplayStatus(plan: MemberPlan): string {
  if (plan.status === "Active" && plan.expiresAt && new Date(plan.expiresAt) < new Date()) return "Inactive"
  return plan.status
}
function planSessionType(planName: string): string {
  if (planName.includes("30")) return "private-30"
  if (planName.includes("45")) return "private-45"
  if (planName.includes("60")) return "private-60"
  return "pack-hour"
}

function CoachStep({ coaches, onSelect }: { coaches: Coach[]; onSelect: (c: Coach) => void }) {
  const COLORS = useColors()
  const styles = makeStyles(COLORS)
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return coaches
    return coaches.filter((c) => c.name.toLowerCase().includes(q) || (c.university ?? "").toLowerCase().includes(q))
  }, [coaches, query])

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchRow}>
        <TextInput style={styles.searchInput} placeholder="Search by name or university…" placeholderTextColor={COLORS.textMuted} value={query} onChangeText={setQuery} autoCorrect={false} />
      </View>
      <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Users size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No prep masters found</Text>
          </View>
        ) : (
          filtered.map((coach) => {
            const uniColors = coach.university ? getUniversityColor(coach.university) : null
            return (
              <TouchableOpacity key={coach.id} style={styles.coachCard} onPress={() => onSelect(coach)} activeOpacity={0.7}>
                <View style={styles.coachAvatar}>
                  <Text style={styles.coachAvatarText}>{coach.name.trim().split(/\s+/).filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.coachName}>{coach.name}</Text>
                  {coach.university ? (
                    <View style={[styles.uniChip, uniColors ? { backgroundColor: uniColors.bg } : {}]}>
                      <Text style={[styles.uniChipText, uniColors ? { color: uniColors.text } : {}]}>{coach.university}</Text>
                    </View>
                  ) : null}
                </View>
                {!coach.hasAvailability ? (
                  <View style={styles.unavailBadge}><Text style={styles.unavailText}>No availability</Text></View>
                ) : <ChevronRight size={18} color={COLORS.textMuted} />}
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

function BookingStep({
  detail, plans, credits, onBack, onConfirm, confirming,
}: {
  detail: CoachDetail; plans: MemberPlan[]; credits: number; onBack: () => void
  onConfirm: (args: { date: string; time: string; notes: string; planId?: string; planSessions?: number; sessionType?: string }) => void
  confirming: boolean
}) {
  const COLORS = useColors()
  const styles = makeStyles(COLORS)
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const activePlans = useMemo(() => plans.filter((p) => planDisplayStatus(p) === "Active"), [plans])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(activePlans.length === 1 ? activePlans[0].id : null)
  const showPlanPicker = activePlans.length > 1

  const currentSunday = useMemo(() => { const s = weekStart(today); s.setDate(s.getDate() + weekOffset * 7); return s }, [today, weekOffset])
  const weekDays = useMemo(() => buildWeekDays(currentSunday), [currentSunday])
  const weekLabel = useMemo(() => {
    const start = weekDays[0]; const end = weekDays[6]
    const sameMonth = start.getMonth() === end.getMonth()
    if (sameMonth) return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
  }, [weekDays])

  const weekSlots = useMemo(() => {
    const now = new Date()
    const todayIso = toIso(now)
    const currentHour = now.getHours()
    return weekDays.map((d) => {
      const iso = toIso(d); const isPast = d < today
      let slots = isPast ? [] : slotsForDate(iso, detail.week)
      if (!isPast && iso === todayIso) {
        slots = slots.filter((slot) => {
          const [timePart, period] = slot.split(" ")
          let h = Number(timePart.split(":")[0])
          if (period === "PM" && h !== 12) h += 12
          else if (period === "AM" && h === 12) h = 0
          return h > currentHour
        })
      }
      const taken = new Set(detail.bookedSlots[iso] ?? [])
      return { date: d, iso, slots, taken, isPast }
    })
  }, [weekDays, detail.week, detail.bookedSlots, today])

  const effectivePlan = activePlans.find((p) => p.id === selectedPlanId) ?? (activePlans.length === 1 ? activePlans[0] : null)
  const noStructuredCredits = activePlans.length === 0 && credits > 0
  const canConfirm = selectedDate && selectedTime && (effectivePlan || noStructuredCredits) && !confirming

  function handleConfirm() {
    if (!selectedDate || !selectedTime) return
    onConfirm({ date: selectedDate, time: selectedTime, notes, planId: effectivePlan?.id, planSessions: effectivePlan?.sessions, sessionType: effectivePlan ? planSessionType(effectivePlan.planName) : "pack-hour" })
  }

  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.bookingScroll} showsVerticalScrollIndicator={false}>
        {showPlanPicker && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>1. Choose your credit</Text>
            <View style={{ gap: SPACING.xs }}>
              {activePlans.map((plan) => {
                const active = selectedPlanId === plan.id
                const activeSingleCount = activePlans.filter((p) => p.sessions === 1).length
                const displayCount = plan.sessions === 1 ? 1 : Math.max(0, credits - activeSingleCount)
                return (
                  <TouchableOpacity key={plan.id} style={[styles.planOption, active && styles.planOptionActive]} onPress={() => setSelectedPlanId(plan.id)} activeOpacity={0.7}>
                    <Text style={[styles.planOptionName, active && { color: COLORS.primary }]}>{plan.planName}</Text>
                    <Text style={styles.planOptionSub}>{displayCount} {displayCount === 1 ? "credit" : "credits"} remaining</Text>
                    {active && <Check size={16} color={COLORS.primary} style={{ marginLeft: "auto" }} />}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}
        {noStructuredCredits && (
          <View style={styles.creditBanner}>
            <Text style={styles.creditBannerText}>You have <Text style={{ fontWeight: "700" }}>{credits}</Text> {credits === 1 ? "credit" : "credits"}. This booking uses 1.</Text>
          </View>
        )}
        {!showPlanPicker && !noStructuredCredits && effectivePlan && (
          <View style={styles.creditBanner}>
            <Text style={styles.creditBannerText}>Using <Text style={{ fontWeight: "700" }}>{effectivePlan.planName}</Text>. This booking uses 1 credit.</Text>
          </View>
        )}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{showPlanPicker ? "2" : "1"}. Pick a date &amp; time</Text>
          <View style={styles.weekNav}>
            <TouchableOpacity style={[styles.weekNavBtn, weekOffset === 0 && { opacity: 0.3 }]} onPress={() => setWeekOffset((w) => w - 1)} disabled={weekOffset === 0}>
              <ChevronLeft size={18} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.weekLabel}>{weekLabel}</Text>
            <TouchableOpacity style={styles.weekNavBtn} onPress={() => setWeekOffset((w) => w + 1)}>
              <ChevronRight size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.calGrid}>
            {weekSlots.map(({ date, iso, slots, taken, isPast }) => {
              const isSelected = selectedDate === iso
              return (
                <View key={iso} style={[styles.calCol, (isPast || slots.length === 0) && { opacity: 0.35 }, isSelected && styles.calColSelected]}>
                  <Text style={styles.calDayLabel}>{DAY_LABELS[date.getDay()]}</Text>
                  <Text style={[styles.calDayNum, isSelected && { color: COLORS.primary }]}>{date.getDate()}</Text>
                  {slots.length === 0 ? <Text style={styles.calNoSlot}>—</Text> : slots.map((slot) => {
                    const isTaken = taken.has(slot); const isSlotSel = isSelected && selectedTime === slot
                    return (
                      <TouchableOpacity key={slot} style={[styles.slotBtn, isSlotSel && styles.slotBtnSelected, isTaken && styles.slotBtnTaken]}
                        onPress={() => { setSelectedDate(iso); setSelectedTime(slot) }} disabled={isTaken || isPast} activeOpacity={0.7}>
                        <Text style={[styles.slotText, isSlotSel && { color: "#fff" }]}>{slot.replace(" ", "\n")}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )
            })}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{showPlanPicker ? "3" : "2"}. Anything we should know?</Text>
          <TextInput style={styles.notesInput} placeholder="Goals for the session, focus areas, choreography you're working on…" placeholderTextColor={COLORS.textMuted} value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" />
        </View>
        <View style={styles.confirmBar}>
          {selectedDate && selectedTime ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.confirmDate}>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {selectedTime}</Text>
              <Text style={styles.confirmWith}>with {detail.coach.name}</Text>
            </View>
          ) : <Text style={[styles.confirmWith, { flex: 1 }]}>Select a date and time to continue.</Text>}
          <TouchableOpacity style={[styles.confirmBtn, !canConfirm && { opacity: 0.4 }]} onPress={handleConfirm} disabled={!canConfirm} activeOpacity={0.8}>
            {confirming ? <ActivityIndicator size="small" color="#fff" /> : <><Check size={16} color="#fff" /><Text style={styles.confirmBtnText}>Confirm</Text></>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

type Step = "coaches" | "booking"

export default function BookScreen() {
  const router = useRouter()
  const { data: session } = useSession()
  const COLORS = useColors()
  const styles = makeStyles(COLORS)
  const [step, setStep] = useState<Step>("coaches")
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [coachesLoading, setCoachesLoading] = useState(true)
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null)
  const [detail, setDetail] = useState<CoachDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [plans, setPlans] = useState<MemberPlan[]>([])
  const [credits, setCredits] = useState(0)
  const [confirming, setConfirming] = useState(false)

  const loadCoaches = useCallback(async () => {
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/booking/coaches`)
      if (error || !data) throw new Error("Failed to load coaches")
      setCoaches((data as { coaches: Coach[] }).coaches)
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Could not load prep masters.") }
    finally { setCoachesLoading(false) }
  }, [])

  const loadDashboard = useCallback(async () => {
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/member/dashboard`)
      if (error || !data) return
      const d = data as { profile: { creditsRemaining: number }; plans: MemberPlan[] }
      setCredits(d.profile.creditsRemaining); setPlans(d.plans)
    } catch {}
  }, [])

  useEffect(() => { loadCoaches(); loadDashboard() }, [loadCoaches, loadDashboard])

  const handleSelectCoach = useCallback(async (coach: Coach) => {
    const activePlans = plans.filter((p) => planDisplayStatus(p) === "Active")
    if (activePlans.length === 0 && credits < 1) {
      Alert.alert("No credits", "You need at least 1 credit to book a session.", [
        { text: "View Plans", onPress: () => router.push("/member/plans" as any) },
        { text: "Cancel", style: "cancel" },
      ])
      return
    }
    setSelectedCoach(coach); setDetailLoading(true)
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/booking/coaches/${coach.id}`)
      if (error || !data) throw new Error("Failed to load availability")
      setDetail(data as CoachDetail); setStep("booking")
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Could not load availability.") }
    finally { setDetailLoading(false) }
  }, [plans, credits, router])

  const handleConfirm = useCallback(async (args: {
    date: string; time: string; notes: string; planId?: string; planSessions?: number; sessionType?: string
  }) => {
    if (!selectedCoach) return
    if (credits < 1) {
      Alert.alert("No credits", "Purchase a package to book a session.", [
        { text: "View Plans", onPress: () => router.push("/member/plans" as any) },
        { text: "Cancel", style: "cancel" },
      ])
      return
    }
    setConfirming(true)
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/booking/create`, {
        method: "POST",
        body: JSON.stringify({ prepMasterId: selectedCoach.id, prepMasterName: selectedCoach.name, date: args.date, time: args.time, notes: args.notes, planId: args.planId, planSessions: args.planSessions, sessionType: args.sessionType }),
        headers: { "Content-Type": "application/json" },
      })
      if (error) throw new Error((error as any)?.message ?? "Failed to book")
      const result = data as { ok: boolean; id?: string; error?: string }
      if (!result.ok) {
        if (result.error === "NO_CREDITS") {
          Alert.alert("No credits", "Purchase a package to book a session.", [{ text: "View Plans", onPress: () => router.push("/member/plans" as any) }, { text: "Cancel", style: "cancel" }])
        } else { Alert.alert("Could not book", result.error ?? "Please try again.") }
        return
      }
      Alert.alert("Session requested!", `Your request with ${selectedCoach.name} on ${args.date} at ${args.time} has been sent. 1 credit used.`, [{ text: "Done", onPress: () => router.back() }])
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Could not create booking.") }
    finally { setConfirming(false) }
  }, [selectedCoach, credits, router])

  const title = step === "coaches" ? "Choose a Prep Master" : selectedCoach?.name ?? "Book a Session"

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { if (step === "booking") { setStep("coaches"); setDetail(null) } else router.back() }}>
          <ChevronLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>
      {coachesLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : step === "coaches" ? (
        <>
          {detailLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={COLORS.primary} /></View>}
          <CoachStep coaches={coaches} onSelect={handleSelectCoach} />
        </>
      ) : detail ? (
        <BookingStep detail={detail} plans={plans} credits={credits} onBack={() => { setStep("coaches"); setDetail(null) }} onConfirm={handleConfirm} confirming={confirming} />
      ) : null}
    </SafeAreaView>
  )
}

function makeStyles(COLORS: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, flex: 1, textAlign: "center" },
    loadingOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.15)", justifyContent: "center", alignItems: "center", zIndex: 10 },
    searchRow: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    searchInput: { backgroundColor: COLORS.surface, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: 9, fontSize: 14, color: COLORS.text },
    coachCard: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md },
    coachAvatar: { width: 44, height: 44, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
    coachAvatarText: { fontSize: 16, fontWeight: "700", color: COLORS.primary },
    coachName: { fontSize: 15, fontWeight: "600", color: COLORS.text },
    uniChip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, backgroundColor: COLORS.grayLight },
    uniChipText: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted },
    unavailBadge: { backgroundColor: COLORS.grayLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
    unavailText: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
    emptyBox: { alignItems: "center", gap: SPACING.sm, paddingTop: SPACING.xl },
    emptyTitle: { fontSize: 15, fontWeight: "600", color: COLORS.textMuted },
    bookingScroll: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: 120 },
    section: { gap: SPACING.sm },
    sectionLabel: { fontSize: 15, fontWeight: "700", color: COLORS.text },
    planOption: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, backgroundColor: COLORS.surface },
    planOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
    planOptionName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
    planOptionSub: { fontSize: 12, color: COLORS.textMuted },
    creditBanner: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, padding: SPACING.sm },
    creditBannerText: { fontSize: 13, color: COLORS.primary },
    weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    weekNavBtn: { width: 32, height: 32, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface },
    weekLabel: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
    calGrid: { flexDirection: "row", gap: 4 },
    calCol: { flex: 1, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 4, gap: 4, alignItems: "center" },
    calColSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
    calDayLabel: { fontSize: 9, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase" },
    calDayNum: { fontSize: 14, fontWeight: "700", color: COLORS.text },
    calNoSlot: { fontSize: 10, color: COLORS.textMuted, paddingVertical: 4 },
    slotBtn: { width: "100%", borderRadius: 4, paddingVertical: 5, backgroundColor: COLORS.grayLight, alignItems: "center" },
    slotBtnSelected: { backgroundColor: COLORS.primary },
    slotBtnTaken: { opacity: 0.35 },
    slotText: { fontSize: 9, fontWeight: "600", color: COLORS.text, textAlign: "center", lineHeight: 12 },
    notesInput: { backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm, fontSize: 14, color: COLORS.text, minHeight: 80 },
    confirmBar: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md },
    confirmDate: { fontSize: 14, fontWeight: "600", color: COLORS.text },
    confirmWith: { fontSize: 12, color: COLORS.textMuted },
    confirmBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.full },
    confirmBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  })
}
