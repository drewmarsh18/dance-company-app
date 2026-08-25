import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native"
import { useState, useEffect } from "react"
import { useRouter, Link } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import * as WebBrowser from "expo-web-browser"
import * as Google from "expo-auth-session/providers/google"
import { signIn, useSession, authClient } from "@/lib/auth-client"
import { SPACING, RADIUS } from "@/constants/theme"
import { useColors } from "@/lib/theme-context"

WebBrowser.maybeCompleteAuthSession()

const GOOGLE_IOS_CLIENT_ID = "31400941000-8g9ud8c2pfgkb1590hb0606jg70jq152.apps.googleusercontent.com"

export default function SignInScreen() {
  const router = useRouter()
  const COLORS = useColors()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: session } = useSession()
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    // Only request basic profile scopes here — calendar.events is a sensitive
    // scope that triggers Google's "unverified app" warning. Users can connect
    // Google Calendar separately via the Enable Calendar sync button in Profile.
    scopes: ["openid", "profile", "email"],
  })

  // Only auto-redirect if a session exists before the user starts signing in.
  // During active sign-in, handleSignIn/handleGoogleToken do the routing themselves.
  useEffect(() => {
    if (session?.user && !loading && !googleLoading) router.replace("/")
  }, [session?.user?.id])

  useEffect(() => {
    if (response?.type === "success") {
      const idToken = response.params?.id_token
      const accessToken = response.authentication?.accessToken
      if (idToken) handleGoogleToken(idToken, accessToken)
      else { setError("Google sign-in failed: no ID token returned."); setGoogleLoading(false) }
    } else if (response?.type === "error") {
      setError(response.error?.message ?? "Google sign-in failed.")
      setGoogleLoading(false)
    } else if (response?.type === "dismiss" || response?.type === "cancel") {
      setGoogleLoading(false)
    }
  }, [response])

  async function handleGoogleToken(idToken: string, accessToken?: string) {
    try {
      const result = await signIn.social({ provider: "google", idToken: { token: idToken, accessToken } } as Parameters<typeof signIn.social>[0])
      if (result?.error) { setError(result.error.message ?? "Google sign-in failed."); return }
      const { data: me } = await authClient.$fetch("https://dance-company-app.vercel.app/api/me")
      const role = (me as any)?.role ?? "dancer"
      const status = (me as any)?.status ?? "active"
      if (status === "pending") router.replace("/(auth)/pending")
      else if (status === "denied") router.replace("/(auth)/denied")
      else if (role === "admin") router.replace("/admin")
      else if (role === "prep_master") router.replace("/portal")
      else router.replace("/member")
    } catch { setError("Google sign-in failed. Please try again.") }
    finally { setGoogleLoading(false) }
  }

  async function handleSignIn() {
    if (!email || !password) { setError("Please enter your email and password."); return }
    setError(null); setLoading(true)
    try {
      const result = await signIn.email({ email: email.trim(), password })
      if (result.error) { setError(result.error.message ?? "Invalid email or password."); return }
      const { data: me } = await authClient.$fetch("https://dance-company-app.vercel.app/api/me")
      const role = (me as any)?.role ?? "dancer"
      const status = (me as any)?.status ?? "active"
      if (status === "pending") router.replace("/(auth)/pending")
      else if (status === "denied") router.replace("/(auth)/denied")
      else if (role === "admin") router.replace("/admin")
      else if (role === "prep_master") router.replace("/portal")
      else router.replace("/member")
    } catch { setError("Something went wrong. Please try again.") }
    finally { setLoading(false) }
  }

  function handleGoogleSignIn() { setError(null); setGoogleLoading(true); promptAsync() }

  const styles = makeStyles(COLORS)

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <View style={styles.logoWrap}>
            <Text style={styles.logo}>CDP</Text>
            <Text style={styles.logoSub}>College Dance Prep</Text>
          </View>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to your account</Text>
          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
          <TouchableOpacity style={[styles.googleBtn, googleLoading && styles.btnDisabled]} onPress={handleGoogleSignIn} disabled={googleLoading || loading} activeOpacity={0.8}>
            {googleLoading ? <ActivityIndicator color={COLORS.text} size="small" /> : <><Text style={styles.googleIcon}>G</Text><Text style={styles.googleBtnText}>Continue with Google</Text></>}
          </TouchableOpacity>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!loading} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={COLORS.textMuted} secureTextEntry value={password} onChangeText={setPassword} editable={!loading} onSubmitEditing={handleSignIn} returnKeyType="go" />
          </View>
          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSignIn} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Sign in</Text>}
          </TouchableOpacity>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/sign-up" asChild><TouchableOpacity><Text style={styles.footerLink}>Sign up</Text></TouchableOpacity></Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(COLORS: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    flex: { flex: 1 },
    container: { flex: 1, padding: SPACING.lg, justifyContent: "center" },
    logoWrap: { alignItems: "center", marginBottom: SPACING.xl },
    logo: { fontSize: 40, fontWeight: "800", color: COLORS.primary, letterSpacing: 2 },
    logoSub: { fontSize: 13, color: COLORS.textMuted, fontWeight: "500", marginTop: 4 },
    heading: { fontSize: 26, fontWeight: "700", color: COLORS.text, marginBottom: 4, fontFamily: "Sora_700Bold" },
    sub: { fontSize: 14, color: COLORS.textMuted, marginBottom: SPACING.lg },
    errorBox: { backgroundColor: COLORS.redLight, borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.md },
    errorText: { fontSize: 13, color: COLORS.red, fontWeight: "500" },
    googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.md },
    googleIcon: { fontSize: 16, fontWeight: "800", color: "#4285F4" },
    googleBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.text },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.md },
    dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
    dividerText: { fontSize: 13, color: COLORS.textMuted },
    field: { marginBottom: SPACING.md },
    label: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 },
    input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.md, fontSize: 15, color: COLORS.text },
    btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding: SPACING.md, alignItems: "center", marginTop: SPACING.sm },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: SPACING.lg },
    footerText: { fontSize: 14, color: COLORS.textMuted },
    footerLink: { fontSize: 14, color: COLORS.primary, fontWeight: "600" },
  })
}
