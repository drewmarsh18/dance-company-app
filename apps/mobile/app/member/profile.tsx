import { useEffect, useState, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { authClient, signOut, useSession } from "@/lib/auth-client"
import { COLORS, SPACING, RADIUS } from "@/constants/theme"

const API_BASE = "https://dance-company-app.vercel.app"

type Profile = {
  recordId: string
  name: string
  email: string
  phone: string
  goals: string
  creditsRemaining: number
}

export default function MemberProfileScreen() {
  const { data: session } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [goals, setGoals] = useState("")
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data, error: err } = await authClient.$fetch(`${API_BASE}/api/member/dashboard`)
      if (err || !data) throw new Error((err as any)?.statusText ?? "Failed to load")
      const p = (data as any).profile as Profile
      setProfile(p)
      setName(p.name)
      setPhone(p.phone)
      setGoals(p.goals)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    }
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    try {
      const { error: err } = await authClient.$fetch(`${API_BASE}/api/member/profile`, {
        method: "PATCH",
        body: JSON.stringify({ recordId: profile.recordId, name, phone, goals }),
        headers: { "Content-Type": "application/json" },
      })
      if (err) throw new Error((err as any)?.statusText ?? "Failed to save")
      setDirty(false)
      Alert.alert("Saved", "Your profile has been updated.")
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save profile.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    router.replace("/(auth)/sign-in")
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Profile</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Avatar placeholder */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(name || session?.user?.name || "?")[0].toUpperCase()}
              </Text>
            </View>
            <Text style={styles.avatarEmail}>{profile?.email ?? session?.user?.email ?? ""}</Text>
          </View>

          <View style={styles.card}>
            <Field label="Name" value={name} onChangeText={(v) => { setName(v); setDirty(true) }} />
            <View style={styles.divider} />
            <Field label="Phone" value={phone} onChangeText={(v) => { setPhone(v); setDirty(true) }} keyboardType="phone-pad" />
            <View style={styles.divider} />
            <Field label="Goals" value={goals} onChangeText={(v) => { setGoals(v); setDirty(true) }} multiline placeholder="e.g. Improve turns, prepare for audition…" />
          </View>

          {dirty && (
            <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Save changes</Text>}
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

function Field({
  label, value, onChangeText, multiline, placeholder, keyboardType,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  multiline?: boolean
  placeholder?: string
  keyboardType?: "default" | "phone-pad" | "email-address"
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={placeholder ?? ""}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType ?? "default"}
        autoCorrect={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  title: { fontSize: 26, fontWeight: "700", color: COLORS.text },
  errorBox: { backgroundColor: COLORS.redLight, borderRadius: RADIUS.sm, padding: SPACING.sm },
  errorText: { fontSize: 13, color: COLORS.red },
  avatarWrap: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.sm },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 30, fontWeight: "700", color: COLORS.primary },
  avatarEmail: { fontSize: 13, color: COLORS.textMuted },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  field: { padding: SPACING.md },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  fieldInput: { fontSize: 15, color: COLORS.text },
  fieldInputMulti: { minHeight: 72, textAlignVertical: "top" },
  divider: { height: 1, backgroundColor: COLORS.border },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    padding: SPACING.md, alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  signOutBtn: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    padding: SPACING.md, alignItems: "center",
  },
  signOutText: { fontSize: 15, fontWeight: "600", color: COLORS.textSecondary },
})
