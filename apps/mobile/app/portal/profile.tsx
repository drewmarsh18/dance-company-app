import { useState } from "react"
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Users, LogOut, ShieldCheck, Sun, Moon, Smartphone, Bell } from "lucide-react-native"
import { authClient, signOut, useSession } from "@/lib/auth-client"
import { SPACING, RADIUS, initials } from "@/constants/theme"
import { useTheme } from "@/lib/theme-context"
import type { ThemePreference } from "@/lib/theme-context"

export default function PortalProfileScreen() {
  const { data: session } = useSession()
  const router = useRouter()
  const { colors: COLORS, theme, setTheme } = useTheme()
  const name = session?.user?.name ?? ""
  const email = session?.user?.email ?? ""

  const [testingPush, setTestingPush] = useState(false)

  async function handleTestPush() {
    setTestingPush(true)
    try {
      const { data } = await authClient.$fetch("https://dance-company-app.vercel.app/api/push-test", { method: "POST" })
      const res = data as { ok: boolean; tokenCount?: number; error?: string }
      if (res.ok) {
        Alert.alert("Sent!", `Push notification sent to ${res.tokenCount} device(s). You should see it shortly.`)
      } else {
        Alert.alert("No token found", res.error ?? "Token not registered. Open the app fresh and grant notification permission, then try again.")
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not send test push.")
    } finally {
      setTestingPush(false)
    }
  }

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => { await signOut(); router.replace("/(auth)/sign-in") } },
    ])
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
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(name)}</Text></View>
          <Text style={styles.avatarName}>{name}</Text>
          <Text style={styles.avatarEmail}>{email}</Text>
          <View style={styles.roleBadge}>
            <ShieldCheck size={12} color={COLORS.primary} />
            <Text style={styles.roleBadgeText}>Prep Master</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Switch view</Text></View>
        <View style={styles.card}>
          <TouchableOpacity style={styles.switchRow} onPress={() => router.replace("/member" as any)} activeOpacity={0.7}>
            <Users size={18} color={COLORS.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Member view</Text>
              <Text style={styles.switchSub}>View your own bookings and credits</Text>
            </View>
          </TouchableOpacity>
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

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Developer</Text></View>
        <TouchableOpacity style={styles.testPushBtn} onPress={handleTestPush} disabled={testingPush} activeOpacity={0.8}>
          {testingPush ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Bell size={16} color={COLORS.primary} />}
          <Text style={styles.testPushText}>{testingPush ? "Sending…" : "Send test push notification"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <LogOut size={16} color={COLORS.textSecondary} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
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
    testPushBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.sm, padding: SPACING.md, backgroundColor: COLORS.primaryLight },
    testPushText: { fontSize: 14, fontWeight: "600", color: COLORS.primary },
    signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.md, marginTop: SPACING.sm },
    signOutText: { fontSize: 15, fontWeight: "600", color: COLORS.textSecondary },
  })
}
