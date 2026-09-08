import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, FlatList,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter, useFocusEffect } from "expo-router"
import { Users, LogOut, ShieldCheck, Sun, Moon, Smartphone, CalendarCheck, CalendarX, Link, LayoutDashboard } from "lucide-react-native"
import * as WebBrowser from "expo-web-browser"
import { authClient, signOut, useSession } from "@/lib/auth-client"
import { SPACING, RADIUS, initials } from "@/constants/theme"
import { useTheme } from "@/lib/theme-context"
import type { ThemePreference } from "@/lib/theme-context"
import { useState, useCallback } from "react"
import { getUniversityColor } from "@/lib/university-colors"

const API_BASE = "https://dance-company-app.vercel.app"

const UNIVERSITIES = [
  "Alabama","Arizona","ASU","Boise","Cincinnati","Coastal Carolina","CSU","CU Boulder",
  "ECU","Florida","FSU","GCU","Indiana","Iowa State","Kansas State","Kansas University",
  "Kentucky","Louisville","LSU Tiger Girls","Mississippi State","NC State","Ole Miss",
  "Ohio State Club Team","Oklahoma","Oregon","Penn State","Pitt","Purdue","Samford",
  "Sam Houston State","SDSU","South Carolina","TCU","Tennessee","Texas State","U Miami",
  "UCLA","UCSB","UK","UNLV","Utah","Vanderbilt","Virginia Tech","Washington",
  "Western Michigan","Wisconsin","WVU","Wichita State",
]

export default function PortalProfileScreen() {
  const { data: session } = useSession()
  const router = useRouter()
  const { colors: COLORS, theme, setTheme } = useTheme()
  const name = session?.user?.name ?? ""
  const email = session?.user?.email ?? ""
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [isGoogleLinked, setIsGoogleLinked] = useState(false)
  const [googleLinking, setGoogleLinking] = useState(false)
  const [actualRole, setActualRole] = useState<string | null>(null)
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [university, setUniversity] = useState("")
  const [pendingUniversity, setPendingUniversity] = useState("")
  const [dirty, setDirty] = useState({ phone: false, address: false, university: false })
  const [saving, setSaving] = useState(false)
  const [uniPickerOpen, setUniPickerOpen] = useState(false)

  const loadConnectedState = useCallback(() => {
    authClient.$fetch(`${API_BASE}/api/portal/calendar-events`).then(({ data }) => {
      setCalendarConnected(!!(data as any)?.connected)
    }).catch(() => {})
    authClient.$fetch(`${API_BASE}/api/auth/list-accounts`).then(({ data }) => {
      const accounts = (data as any) ?? []
      setIsGoogleLinked(Array.isArray(accounts) && accounts.some((a: any) => a.providerId === "google"))
    }).catch(() => {})
    authClient.$fetch(`${API_BASE}/api/me`).then(({ data }) => {
      if (data) setActualRole((data as any).role ?? null)
    }).catch(() => {})
    authClient.$fetch(`${API_BASE}/api/portal/dashboard`).then(({ data }) => {
      const pm = (data as any)?.prepMaster
      setPhone(pm?.phone ?? "")
      setAddress(pm?.address ?? "")
      setUniversity(pm?.university ?? "")
      setPendingUniversity(pm?.university ?? "")
      setDirty({ phone: false, address: false, university: false })
    }).catch(() => {})
  }, [])

  // Re-check on every focus so the UI updates after returning from OAuth browser
  useFocusEffect(loadConnectedState)

  async function handleConnectGoogle() {
    setGoogleLinking(true)
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: "cdp://" })
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Could not connect Google account.") }
    finally {
      setGoogleLinking(false)
      loadConnectedState()
    }
  }

  async function handleConnectCalendar() {
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/google-calendar/url?for=portal`)
      if (error || !(data as any)?.url) throw new Error("Could not get calendar auth URL")
      const result = await WebBrowser.openAuthSessionAsync((data as any).url, "cdp://portal/profile")
      if (result.type === "success") loadConnectedState()
      else Alert.alert("Error", "Could not connect Google Calendar. Please try again.")
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not connect Google Calendar.")
    }
  }

  async function handleDisconnectCalendar() {
    Alert.alert("Disconnect Google Calendar", "Are you sure you want to disconnect Google Calendar?", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: async () => {
        await authClient.$fetch(`${API_BASE}/api/google-calendar`, { method: "DELETE" })
        setCalendarConnected(false)
      }},
    ])
  }

  async function saveField(fields: Record<string, string>) {
    setSaving(true)
    try {
      await authClient.$fetch(`${API_BASE}/api/portal/profile`, {
        method: "PATCH",
        body: JSON.stringify(fields),
        headers: { "Content-Type": "application/json" },
      })
    } catch {
      Alert.alert("Error", "Could not save. Please try again.")
      throw new Error("save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePhone() {
    await saveField({ phone }).catch(() => {})
    setDirty(d => ({ ...d, phone: false }))
  }

  async function handleSaveAddress() {
    await saveField({ address }).catch(() => {})
    setDirty(d => ({ ...d, address: false }))
  }

  function handleSelectUniversity(v: string) {
    setUniPickerOpen(false)
    if (v === university) return
    Alert.alert(
      "Switch University",
      `Are you sure you want to change your university to "${v}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Save", onPress: async () => {
          setPendingUniversity(v)
          try {
            await saveField({ university: v })
            setUniversity(v)
            setPendingUniversity(v)
          } catch {
            setPendingUniversity(university)
          }
        }},
      ],
    )
  }

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => { await signOut(); router.replace("/(auth)/sign-in") } },
    ])
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all associated data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            try {
              await authClient.$fetch(`${API_BASE}/api/member/delete-account`, { method: "DELETE" })
              await signOut()
              router.replace("/(auth)/sign-in")
            } catch {
              Alert.alert("Error", "Failed to delete account. Please try again.")
            }
          },
        },
      ],
    )
  }

  const styles = makeStyles(COLORS)

  const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: any }[] = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Smartphone },
  ]

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View />
          <TouchableOpacity onPress={handleDeleteAccount} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.deleteTiny}>Delete Account</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(name)}</Text></View>
          <Text style={styles.avatarName}>{name}</Text>
          <Text style={styles.avatarEmail}>{email}</Text>
          <View style={styles.roleBadge}>
            <ShieldCheck size={12} color={COLORS.primary} />
            <Text style={styles.roleBadgeText}>PrepMaster</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>My Info</Text></View>
        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.fieldInput}
              value={phone}
              onChangeText={(v) => { setPhone(v); setDirty(d => ({ ...d, phone: true })) }}
              placeholder="Add phone number"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
            />
            {dirty.phone && (
              <TouchableOpacity style={styles.fieldSaveBtn} onPress={handleSavePhone} disabled={saving} activeOpacity={0.8}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.fieldSaveText}>Save</Text>}
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.fieldRow} onPress={() => setUniPickerOpen(true)} activeOpacity={0.7}>
            <Text style={styles.fieldLabel}>University</Text>
            {university ? (() => {
              const uc = getUniversityColor(university)
              return (
                <View style={[styles.uniChip, { backgroundColor: uc.bg }]}>
                  <Text style={[styles.uniChipText, { color: uc.text }]}>{university}</Text>
                </View>
              )
            })() : (
              <Text style={[styles.fieldInput, { color: COLORS.textMuted }]}>Select university</Text>
            )}
          </TouchableOpacity>
          <View style={styles.divider} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={styles.fieldInput}
              value={address}
              onChangeText={(v) => { setAddress(v); setDirty(d => ({ ...d, address: true })) }}
              placeholder="Add address"
              placeholderTextColor={COLORS.textMuted}
            />
            {dirty.address && (
              <TouchableOpacity style={styles.fieldSaveBtn} onPress={handleSaveAddress} disabled={saving} activeOpacity={0.8}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.fieldSaveText}>Save</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Switch view</Text></View>
        <View style={styles.card}>
          {actualRole === "admin" && (
            <>
              <TouchableOpacity style={styles.switchRow} onPress={() => router.replace("/admin" as any)} activeOpacity={0.7}>
                <LayoutDashboard size={18} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Admin view</Text>
                  <Text style={styles.switchSub}>Manage members and bookings</Text>
                </View>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md }} />
            </>
          )}
          <TouchableOpacity style={styles.switchRow} onPress={() => router.replace("/member" as any)} activeOpacity={0.7}>
            <Users size={18} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Member view</Text>
              <Text style={styles.switchSub}>View your own bookings and credits</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Connected Accounts</Text></View>
        <View style={styles.connectedRow}>
          <View style={styles.connectedItem}>
            <View style={[styles.dot, isGoogleLinked ? styles.dotOn : styles.dotOff]} />
            {isGoogleLinked ? (
              <Text style={styles.connectedLabel}>Google Auth</Text>
            ) : (
              <TouchableOpacity onPress={handleConnectGoogle} disabled={googleLinking} activeOpacity={0.7}>
                {googleLinking
                  ? <ActivityIndicator size="small" color={COLORS.textMuted} style={{ marginLeft: 2 }} />
                  : <Text style={[styles.connectedLabel, styles.connectedAction]}>Google Auth</Text>}
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.connectedItem}>
            <View style={[styles.dot, calendarConnected ? styles.dotOn : styles.dotOff]} />
            {isGoogleLinked ? (
              <TouchableOpacity onPress={calendarConnected ? handleDisconnectCalendar : handleConnectCalendar} activeOpacity={0.7}>
                <Text style={[styles.connectedLabel, !calendarConnected && styles.connectedAction]}>
                  Google Calendar
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.connectedLabel, { color: COLORS.textMuted }]}>Google Calendar</Text>
            )}
          </View>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Appearance</Text></View>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map(({ value, label, Icon }) => {
            const active = theme === value
            return (
              <TouchableOpacity key={value} style={[styles.themeBtn, active && styles.themeBtnActive]} onPress={() => setTheme(value)} activeOpacity={0.7}>
                <Icon size={16} color={active ? COLORS.primary : COLORS.textMuted} />
                <Text style={[styles.themeBtnText, active && { color: COLORS.primary }]}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <LogOut size={16} color={COLORS.textSecondary} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={uniPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setUniPickerOpen(false)}>
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select University</Text>
            <TouchableOpacity onPress={() => setUniPickerOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={UNIVERSITIES}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => {
              const uc = getUniversityColor(item)
              const selected = item === university
              return (
                <TouchableOpacity
                  style={[styles.uniOption, selected && styles.uniOptionSelected]}
                  onPress={() => handleSelectUniversity(item)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.uniChip, { backgroundColor: uc.bg }]}>
                    <Text style={[styles.uniChipText, { color: uc.text }]}>{item}</Text>
                  </View>
                  {selected && <Text style={styles.uniCheckmark}>✓</Text>}
                </TouchableOpacity>
              )
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

function makeStyles(COLORS: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
    avatarWrap: { alignItems: "center", gap: 6, paddingVertical: SPACING.sm },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
    avatarText: { fontSize: 32, fontWeight: "700", color: COLORS.primary },
    avatarName: { fontSize: 20, fontWeight: "700", color: COLORS.text },
    avatarEmail: { fontSize: 13, color: COLORS.textMuted },
    roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
    roleBadgeText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
    sectionHeader: { marginTop: SPACING.sm },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
    card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
    switchRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md },
    switchLabel: { fontSize: 15, fontWeight: "600", color: COLORS.text },
    switchSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
    themeRow: { flexDirection: "row", gap: SPACING.sm },
    themeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
    themeBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
    themeBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
    accountRowLinked: { backgroundColor: COLORS.greenLight },
    connectedRow: { flexDirection: "row", gap: SPACING.lg },
    connectedItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    dotOn: { backgroundColor: COLORS.green },
    dotOff: { backgroundColor: COLORS.border },
    connectedLabel: { fontSize: 13, color: COLORS.text, fontWeight: "500" },
    connectedAction: { color: COLORS.textMuted },
    signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.md, marginTop: SPACING.sm },
    signOutText: { fontSize: 15, fontWeight: "600", color: COLORS.textSecondary },
    titleRow: { flexDirection: "row", justifyContent: "flex-end" },
    deleteTiny: { fontSize: 12, color: COLORS.red, fontWeight: "500" },
    divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },
    fieldRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 12 },
    fieldLabel: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted, width: 80 },
    fieldInput: { flex: 1, fontSize: 14, color: COLORS.text },
    fieldSaveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
    fieldSaveText: { fontSize: 13, fontWeight: "600", color: "#fff" },
    uniChip: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
    uniChipText: { fontSize: 13, fontWeight: "600" },
    modalSafe: { flex: 1, backgroundColor: COLORS.background },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    modalTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
    modalCancel: { fontSize: 15, color: COLORS.primary },
    modalList: { padding: SPACING.md, gap: SPACING.sm },
    uniOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.sm },
    uniOptionSelected: { backgroundColor: COLORS.primaryLight },
    uniCheckmark: { fontSize: 16, color: COLORS.primary, fontWeight: "700" },
  })
}
