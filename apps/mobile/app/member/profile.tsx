import { useEffect, useState, useCallback } from "react"
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter, useLocalSearchParams } from "expo-router"
import { Link, Sun, Moon, Smartphone, CalendarCheck, CalendarX } from "lucide-react-native"
import * as WebBrowser from "expo-web-browser"
import { authClient, signOut, useSession } from "@/lib/auth-client"
import { SPACING, RADIUS, initials } from "@/constants/theme"
import { useTheme } from "@/lib/theme-context"
import type { ThemePreference } from "@/lib/theme-context"

const API_BASE = "https://dance-company-app.vercel.app"

type Profile = { recordId: string; name: string; email: string; phone: string; goals: string; creditsRemaining: number; parentEmail?: string; isParentView?: boolean }

export default function MemberProfileScreen() {
  const { data: session } = useSession()
  const router = useRouter()
  const { colors: COLORS, theme, setTheme } = useTheme()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")

  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  const [goals, setGoals] = useState("")
  const [parentEmail, setParentEmail] = useState("")
  const [dirty, setDirty] = useState(false)
  const [googleLinking, setGoogleLinking] = useState(false)
  const [isGoogleLinked, setIsGoogleLinked] = useState(false)
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [actualRole, setActualRole] = useState<string | null>(null)
  const params = useLocalSearchParams<{ calendar?: string }>()

  const load = useCallback(async () => {
    try {
      const [dashResult, accountsResult, meResult, calResult] = await Promise.all([
        authClient.$fetch(`${API_BASE}/api/member/dashboard`),
        authClient.$fetch(`${API_BASE}/api/auth/list-accounts`),
        authClient.$fetch(`${API_BASE}/api/me`),
        authClient.$fetch(`${API_BASE}/api/member/calendar-events`),
      ])
      if (dashResult.error || !dashResult.data) throw new Error((dashResult.error as any)?.statusText ?? "Failed to load")
      const p = (dashResult.data as any).profile as Profile
      setProfile(p); setName(p.name); setPhone(formatPhone(p.phone ?? "")); setGoals(p.goals); setParentEmail(p.parentEmail ?? ""); setError(null)
      const accounts = (accountsResult.data as any) ?? []
      setIsGoogleLinked(Array.isArray(accounts) && accounts.some((a: any) => a.provider === "google"))
      if (!meResult.error && meResult.data) setActualRole((meResult.data as any).role ?? null)
      if (!calResult.error && calResult.data) setCalendarConnected((calResult.data as any).connected === true)
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong.") }
  }, [])

  useEffect(() => {
    if (params.calendar === "connected") { setCalendarConnected(true) }
  }, [params.calendar])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    try {
      const { error: err } = await authClient.$fetch(`${API_BASE}/api/member/profile`, {
        method: "PATCH",
        body: JSON.stringify({ recordId: profile.recordId, name, phone, goals, parentEmail: parentEmail.trim() || null }),
        headers: { "Content-Type": "application/json" },
      })
      if (err) throw new Error((err as any)?.statusText ?? "Failed to save")
      setDirty(false)
      Alert.alert("Saved", "Your profile has been updated.")
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed to save profile.") }
    finally { setSaving(false) }
  }

  async function handleConnectCalendar() {
    try {
      const { data, error } = await authClient.$fetch(`${API_BASE}/api/google-calendar/url?for=member`)
      if (error || !(data as any)?.url) throw new Error("Could not get calendar auth URL")
      const result = await WebBrowser.openAuthSessionAsync((data as any).url, "cdp://member/profile")
      if (result.type === "success") {
        const connected = result.url?.includes("calendar=connected")
        if (connected) setCalendarConnected(true)
        else Alert.alert("Error", "Could not connect Google Calendar. Please try again.")
      }
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Could not connect Google Calendar.") }
  }

  async function handleDisconnectCalendar() {
    Alert.alert("Disconnect Google Calendar", "Remove calendar access?", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: async () => {
        await authClient.$fetch(`${API_BASE}/api/google-calendar/disconnect`, { method: "POST" })
        setCalendarConnected(false)
      }},
    ])
  }

  async function handleConnectGoogle() {
    setGoogleLinking(true)
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: "cdp://" })
      const { data } = await authClient.$fetch(`${API_BASE}/api/auth/list-accounts`)
      const accounts = (data as any) ?? []
      setIsGoogleLinked(Array.isArray(accounts) && accounts.some((a: any) => a.provider === "google"))
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Could not connect Google account.") }
    finally { setGoogleLinking(false) }
  }

  async function handleSignOut() { await signOut(); router.replace("/(auth)/sign-in") }

  const styles = makeStyles(COLORS)

  const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: any }[] = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Smartphone },
  ]

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Profile</Text>
          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(name || session?.user?.name || "?")}</Text>
            </View>
            <Text style={styles.avatarEmail}>{profile?.email ?? session?.user?.email ?? ""}</Text>
          </View>

          <View style={styles.card}>
            <Field label="Name" value={name} onChangeText={(v) => { setName(v); setDirty(true) }} COLORS={COLORS} styles={styles} />
            <View style={styles.divider} />
            <Field label="Phone" value={phone} onChangeText={(v) => { setPhone(formatPhone(v)); setDirty(true) }} keyboardType="phone-pad" COLORS={COLORS} styles={styles} />
            <View style={styles.divider} />
            <Field label="Goals" value={goals} onChangeText={(v) => { setGoals(v); setDirty(true) }} multiline placeholder="e.g. Improve turns, prepare for audition…" COLORS={COLORS} styles={styles} />
            <View style={styles.divider} />
            <Field label="Parent Email" value={parentEmail} onChangeText={(v) => { setParentEmail(v); setDirty(true) }} keyboardType="email-address" placeholder="parent@example.com" COLORS={COLORS} styles={styles} />
          </View>
          {!!parentEmail && <Text style={[styles.avatarEmail, { marginTop: -8, fontSize: 11 }]}>Parent can sign in to view this account.</Text>}

          {dirty && (
            <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Save changes</Text>}
            </TouchableOpacity>
          )}

          {/* Appearance */}
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

          {/* Connected accounts */}
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Connected accounts</Text></View>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.accountRow, isGoogleLinked && styles.accountRowLinked]}
              onPress={isGoogleLinked ? undefined : handleConnectGoogle}
              disabled={isGoogleLinked || googleLinking}
              activeOpacity={isGoogleLinked ? 1 : 0.8}
            >
              {googleLinking ? <ActivityIndicator size="small" color={COLORS.text} /> : <Link size={18} color={isGoogleLinked ? COLORS.green : COLORS.text} />}
              <Text style={[styles.googleBtnText, isGoogleLinked && { color: COLORS.green }]}>
                {isGoogleLinked ? "Google connected" : "Connect Google account"}
              </Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={[styles.accountRow, calendarConnected && styles.accountRowLinked]}
              onPress={calendarConnected ? handleDisconnectCalendar : handleConnectCalendar}
              activeOpacity={0.8}
            >
              {calendarConnected
                ? <CalendarCheck size={18} color={COLORS.green} />
                : <CalendarX size={18} color={COLORS.text} />}
              <Text style={[styles.googleBtnText, calendarConnected && { color: COLORS.green }]}>
                {calendarConnected ? "Google Calendar connected" : "Connect Google Calendar"}
              </Text>
            </TouchableOpacity>
          </View>

          {(actualRole === "admin" || actualRole === "prep_master") && (
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Switch view</Text></View>
          )}
          {actualRole === "admin" && (
            <TouchableOpacity style={styles.switchBtn} onPress={() => router.replace("/admin")} activeOpacity={0.8}>
              <Text style={styles.switchBtnText}>Switch to Admin view</Text>
            </TouchableOpacity>
          )}
          {(actualRole === "admin" || actualRole === "prep_master") && (
            <TouchableOpacity style={styles.switchBtn} onPress={() => router.replace("/portal")} activeOpacity={0.8}>
              <Text style={styles.switchBtnText}>Switch to PrepMaster view</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Field({ label, value, onChangeText, multiline, placeholder, keyboardType, COLORS, styles }: {
  label: string; value: string; onChangeText: (v: string) => void
  multiline?: boolean; placeholder?: string; keyboardType?: "default" | "phone-pad" | "email-address"
  COLORS: any; styles: any
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value} onChangeText={onChangeText} multiline={multiline}
        placeholder={placeholder ?? ""} placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType ?? "default"} autoCorrect={false}
      />
    </View>
  )
}

function makeStyles(COLORS: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
    title: { fontSize: 26, fontWeight: "700", color: COLORS.text, fontFamily: "Sora_700Bold" },
    errorBox: { backgroundColor: COLORS.redLight, borderRadius: RADIUS.sm, padding: SPACING.sm },
    errorText: { fontSize: 13, color: COLORS.red },
    avatarWrap: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.sm },
    avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
    avatarText: { fontSize: 30, fontWeight: "700", color: COLORS.primary },
    avatarEmail: { fontSize: 13, color: COLORS.textMuted },
    card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
    field: { padding: SPACING.md },
    fieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
    fieldInput: { fontSize: 15, color: COLORS.text },
    fieldInputMulti: { minHeight: 72, textAlignVertical: "top" },
    divider: { height: 1, backgroundColor: COLORS.border },
    btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding: SPACING.md, alignItems: "center" },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    sectionHeader: { marginTop: SPACING.sm },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
    themeRow: { flexDirection: "row", gap: SPACING.sm },
    themeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
    themeBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
    themeBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
    googleBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.md, backgroundColor: COLORS.surface },
    googleBtnLinked: { borderColor: COLORS.green, backgroundColor: COLORS.greenLight },
    googleBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.text },
    accountRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md },
    accountRowLinked: { backgroundColor: COLORS.greenLight },
    switchBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.sm, padding: SPACING.md, alignItems: "center", backgroundColor: COLORS.primaryLight },
    switchBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.primary },
    signOutBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.md, alignItems: "center" },
    signOutText: { fontSize: 15, fontWeight: "600", color: COLORS.textSecondary },
  })
}
