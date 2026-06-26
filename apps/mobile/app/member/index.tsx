import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { signOut, useSession } from "@/lib/auth-client"
import { COLORS, SPACING, RADIUS } from "@/constants/theme"

export default function MemberHomeScreen() {
  const { data: session } = useSession()
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.replace("/(auth)/sign-in")
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <Text style={styles.heading}>Welcome{session?.user?.name ? `, ${session.user.name}` : ""}!</Text>
        <Text style={styles.sub}>Member dashboard coming soon.</Text>
        <TouchableOpacity style={styles.btn} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.btnText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, padding: SPACING.lg, justifyContent: "center", alignItems: "center", gap: SPACING.md },
  heading: { fontSize: 24, fontWeight: "700", color: COLORS.text },
  sub: { fontSize: 14, color: COLORS.textMuted },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
})
