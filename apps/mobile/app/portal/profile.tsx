import { useState, useCallback } from "react"
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { CalendarPlus, Users, LogOut, ShieldCheck } from "lucide-react-native"
import { authClient, signOut, useSession } from "@/lib/auth-client"
import { COLORS, SPACING, RADIUS, initials } from "@/constants/theme"

const API_BASE = "https://dance-company-app.vercel.app"

type Client = { userId: string; name: string; email: string }

const TIMES = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM",
  "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM",
]

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function PortalProfileScreen() {
  const { data: session } = useSession()
  const router = useRouter()
  const name = session?.user?.name ?? ""
  const email = session?.user?.email ?? ""

  const [showBook, setShowBook] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedDate, setSelectedDate] = useState(toIso(new Date()))
  const [selectedTime, setSelectedTime] = useState("")
  const [notes, setNotes] = useState("")
  const [booking, setBooking] = useState(false)

  const loadClients = useCallback(async () => {
    setClientsLoading(true)
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/portal/book`)
      if (error || !data) throw new Error("Failed to load clients")
      setClients((data as { clients: Client[] }).clients)
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not load past clients.")
    } finally {
      setClientsLoading(false)
    }
  }, [])

  function openBooking() {
    setShowBook(true)
    loadClients()
  }

  async function handleBook() {
    if (!selectedClient || !selectedDate || !selectedTime) {
      Alert.alert("Missing fields", "Please select a client, date, and time.")
      return
    }
    setBooking(true)
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/portal/book`, {
        method: "POST",
        body: JSON.stringify({ dancerEmail: selectedClient.email, date: selectedDate, time: selectedTime, notes }),
        headers: { "Content-Type": "application/json" },
      })
      if (error) throw new Error((error as any)?.message ?? "Failed")
      const res = data as { ok: boolean; error?: string }
      if (!res.ok) throw new Error(res.error ?? "Failed")
      Alert.alert("Booked!", `Session with ${selectedClient.name} on ${selectedDate} at ${selectedTime} has been created.`)
      setShowBook(false)
      setSelectedClient(null)
      setSelectedTime("")
      setNotes("")
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not create booking.")
    } finally {
      setBooking(false)
    }
  }

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out", style: "destructive", onPress: async () => {
          await signOut()
          router.replace("/(auth)/sign-in")
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </View>
          <Text style={styles.avatarName}>{name}</Text>
          <Text style={styles.avatarEmail}>{email}</Text>
          <View style={styles.roleBadge}>
            <ShieldCheck size={12} color={COLORS.primary} />
            <Text style={styles.roleBadgeText}>Prep Master</Text>
          </View>
        </View>

        {/* Switch view */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Switch view</Text>
        </View>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.switchRow}
            onPress={() => router.replace("/member" as any)}
            activeOpacity={0.7}
          >
            <Users size={18} color={COLORS.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Member view</Text>
              <Text style={styles.switchSub}>View your own bookings and credits</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Book a session */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Book a session</Text>
        </View>
        <TouchableOpacity
          style={styles.bookCard}
          onPress={openBooking}
          activeOpacity={0.7}
        >
          <CalendarPlus size={18} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bookCardTitle}>Schedule for a past client</Text>
            <Text style={styles.bookCardSub}>Create a confirmed session with a member you've previously worked with.</Text>
          </View>
        </TouchableOpacity>

        {/* Inline booking form */}
        {showBook && (
          <View style={styles.bookForm}>
            <Text style={styles.bookFormTitle}>New session</Text>

            {/* Client picker */}
            <Text style={styles.fieldLabel}>Client</Text>
            {clientsLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : clients.length === 0 ? (
              <Text style={styles.emptyText}>No past clients found.</Text>
            ) : (
              <View style={styles.chipWrap}>
                {clients.map((c) => (
                  <TouchableOpacity
                    key={c.userId}
                    style={[styles.chip, selectedClient?.userId === c.userId && styles.chipSelected]}
                    onPress={() => setSelectedClient(c)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, selectedClient?.userId === c.userId && { color: COLORS.primary }]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Date */}
            <Text style={styles.fieldLabel}>Date</Text>
            <View style={styles.dateRow}>
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() + i)
                const iso = toIso(d)
                const isSelected = selectedDate === iso
                return (
                  <TouchableOpacity
                    key={iso}
                    style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                    onPress={() => setSelectedDate(iso)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dateChipDay, isSelected && { color: COLORS.primary }]}>
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                    </Text>
                    <Text style={[styles.dateChipNum, isSelected && { color: COLORS.primary }]}>
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Time */}
            <Text style={styles.fieldLabel}>Time</Text>
            <View style={styles.chipWrap}>
              {TIMES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, selectedTime === t && styles.chipSelected]}
                  onPress={() => setSelectedTime(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selectedTime === t && { color: COLORS.primary }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.bookActions}>
              <TouchableOpacity
                style={[styles.bookBtn, booking && { opacity: 0.6 }]}
                onPress={handleBook}
                disabled={booking}
                activeOpacity={0.8}
              >
                {booking
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.bookBtnText}>Confirm booking</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowBook(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <LogOut size={16} color={COLORS.textSecondary} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },

  avatarWrap: { alignItems: "center", gap: 6, paddingVertical: SPACING.sm },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 32, fontWeight: "700", color: COLORS.primary },
  avatarName: { fontSize: 20, fontWeight: "700", color: COLORS.text },
  avatarEmail: { fontSize: 13, color: COLORS.textMuted },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  roleBadgeText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },

  sectionHeader: { marginTop: SPACING.sm },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  switchRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md },
  switchLabel: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  switchSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },

  bookCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  bookCardTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  bookCardSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },

  bookForm: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm,
  },
  bookFormTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  emptyText: { fontSize: 13, color: COLORS.textMuted },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  chipText: { fontSize: 13, fontWeight: "600", color: COLORS.text },

  dateRow: { flexDirection: "row", gap: 6 },
  dateChip: {
    flex: 1, alignItems: "center", paddingVertical: 8,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  dateChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  dateChipDay: { fontSize: 9, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase" },
  dateChipNum: { fontSize: 16, fontWeight: "700", color: COLORS.text },

  bookActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  bookBtn: {
    flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingVertical: 12, alignItems: "center",
  },
  bookBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  cancelBtn: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    paddingVertical: 12, paddingHorizontal: SPACING.md, alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.textMuted },

  signOutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    padding: SPACING.md, marginTop: SPACING.sm,
  },
  signOutText: { fontSize: 15, fontWeight: "600", color: COLORS.textSecondary },
})
