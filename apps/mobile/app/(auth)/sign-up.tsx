import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from "react-native"
import { useState, useEffect } from "react"
import { useRouter, Link } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import * as WebBrowser from "expo-web-browser"
import * as Google from "expo-auth-session/providers/google"
import { signUp, signIn, authClient } from "@/lib/auth-client"
import { SPACING, RADIUS } from "@/constants/theme"
import { useColors } from "@/lib/theme-context"

WebBrowser.maybeCompleteAuthSession()

const GOOGLE_IOS_CLIENT_ID = "31400941000-8g9ud8c2pfgkb1590hb0606jg70jq152.apps.googleusercontent.com"

const API_BASE = "https://dance-company-app.vercel.app"

export default function SignUpScreen() {
  const router = useRouter()
  const COLORS = useColors()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [goals, setGoals] = useState("")
  const [parentEmail, setParentEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
  })

  useEffect(() => {
    if (response?.type === "success") {
      const idToken = response.params?.id_token
      const accessToken = response.authentication?.accessToken
      if (idToken) handleGoogleToken(idToken, accessToken)
      else { setError("Google sign-up failed: no ID token returned."); setGoogleLoading(false) }
    } else if (response?.type === "error") {
      setError(response.error?.message ?? "Google sign-up failed.")
      setGoogleLoading(false)
    } else if (response?.type === "dismiss" || response?.type === "cancel") {
      setGoogleLoading(false)
    }
  }, [response])

  async function handleGoogleToken(idToken: string, accessToken?: string) {
    try {
      const result = await signIn.social({ provider: "google", idToken: { token: idToken, accessToken } } as Parameters<typeof signIn.social>[0])
      if (result?.error) { setError(result.error.message ?? "Google sign-up failed."); return }

      // Sync name/image from Google token if missing
      try {
        const parts = idToken.split(".")
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))
          const sessionUser = (result as any)?.data?.user
          const updates: Record<string, string> = {}
          if (payload.name && !sessionUser?.name) updates.name = payload.name
          if (payload.picture && !sessionUser?.image) updates.image = payload.picture
          if (Object.keys(updates).length > 0) {
            await authClient.$fetch("https://dance-company-app.vercel.app/api/auth/update-user", {
              method: "POST",
              body: JSON.stringify(updates),
              headers: { "Content-Type": "application/json" },
            })
            await authClient.$fetch("https://dance-company-app.vercel.app/api/auth/get-session")
          }
        }
      } catch {}

      const { data: me } = await authClient.$fetch("https://dance-company-app.vercel.app/api/me")
      const role = (me as any)?.role ?? "dancer"
      const status = (me as any)?.status ?? "active"

      if (status === "pending") router.replace("/(auth)/welcome")
      else if (status === "denied") router.replace("/(auth)/denied")
      else if (role === "admin") router.replace("/admin")
      else if (role === "prep_master") router.replace("/portal")
      else router.replace("/member")
    } catch { setError("Google sign-up failed. Please try again.") }
    finally { setGoogleLoading(false) }
  }

  function handleGoogleSignUp() { setError(null); setGoogleLoading(true); promptAsync() }

  async function handleSignUp() {
    if (!name || !email || !password) { setError("Please fill in all required fields."); return }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    setError(null); setLoading(true)
    try {
      const result = await signUp.email({ name: name.trim(), email: email.trim(), password })
      if (result.error) { setError(result.error.message ?? "Could not create account."); return }

      // Create Airtable profile and save extra fields if provided
      if (goals.trim() || parentEmail.trim()) {
        try {
          const { data: dash } = await authClient.$fetch(`${API_BASE}/api/member/dashboard`)
          const recordId = (dash as any)?.profile?.recordId
          if (recordId) {
            await authClient.$fetch(`${API_BASE}/api/member/profile`, {
              method: "PATCH",
              body: JSON.stringify({ recordId, goals: goals.trim(), parentEmail: parentEmail.trim() || null }),
              headers: { "Content-Type": "application/json" },
            })
          }
        } catch {
          // Non-fatal — profile can be completed later
        }
      }

      router.replace("/(auth)/pending")
    } catch { setError("Something went wrong. Please try again.") }
    finally { setLoading(false) }
  }

  const styles = makeStyles(COLORS)

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <Text style={styles.logo}>CDP</Text>
            <Text style={styles.logoSub}>College Dance Prep</Text>
          </View>
          <Text style={styles.heading}>Create account</Text>
          <Text style={styles.sub}>Join College Dance Prep</Text>
          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

          <TouchableOpacity style={[styles.googleBtn, googleLoading && styles.btnDisabled]} onPress={handleGoogleSignUp} disabled={googleLoading || loading} activeOpacity={0.8}>
            {googleLoading ? <ActivityIndicator color={COLORS.text} size="small" /> : <><Text style={styles.googleIcon}>G</Text><Text style={styles.googleBtnText}>Continue with Google</Text></>}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with email</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput style={styles.input} placeholder="Jane Smith" placeholderTextColor={COLORS.textMuted} autoCapitalize="words" value={name} onChangeText={setName} editable={!loading} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!loading} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} placeholder="Min. 8 characters" placeholderTextColor={COLORS.textMuted} secureTextEntry value={password} onChangeText={setPassword} editable={!loading} returnKeyType="next" />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>optional</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Training goals</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="e.g. Improve turns, prepare for college auditions…"
              placeholderTextColor={COLORS.textMuted}
              multiline numberOfLines={3}
              value={goals} onChangeText={setGoals} editable={!loading}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Parent email <Text style={styles.labelOptional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="parent@example.com"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none" keyboardType="email-address"
              value={parentEmail} onChangeText={setParentEmail} editable={!loading}
              onSubmitEditing={handleSignUp} returnKeyType="go"
            />
            <Text style={styles.hint}>A parent can sign in to view and manage this account.</Text>
          </View>

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSignUp} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Create account</Text>}
          </TouchableOpacity>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/sign-in" asChild><TouchableOpacity><Text style={styles.footerLink}>Sign in</Text></TouchableOpacity></Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(COLORS: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    flex: { flex: 1 },
    container: { padding: SPACING.lg, justifyContent: "center", flexGrow: 1 },
    logoWrap: { alignItems: "center", marginBottom: SPACING.xl },
    logo: { fontSize: 40, fontWeight: "800", color: COLORS.primary, letterSpacing: 2 },
    logoSub: { fontSize: 13, color: COLORS.textMuted, fontWeight: "500", marginTop: 4 },
    heading: { fontSize: 26, fontWeight: "700", color: COLORS.text, marginBottom: 4, fontFamily: "Sora_700Bold" },
    sub: { fontSize: 14, color: COLORS.textMuted, marginBottom: SPACING.lg },
    errorBox: { backgroundColor: COLORS.redLight, borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.md },
    errorText: { fontSize: 13, color: COLORS.red, fontWeight: "500" },
    field: { marginBottom: SPACING.md },
    label: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 },
    labelOptional: { fontSize: 13, fontWeight: "400", color: COLORS.textMuted },
    input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.md, fontSize: 15, color: COLORS.text },
    inputMulti: { minHeight: 72, textAlignVertical: "top" },
    hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 5, lineHeight: 17 },
    googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.md },
    googleIcon: { fontSize: 16, fontWeight: "800", color: "#4285F4" },
    googleBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.text },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.md },
    dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
    dividerText: { fontSize: 12, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
    btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding: SPACING.md, alignItems: "center", marginTop: SPACING.sm },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: SPACING.lg },
    footerText: { fontSize: 14, color: COLORS.textMuted },
    footerLink: { fontSize: 14, color: COLORS.primary, fontWeight: "600" },
  })
}
