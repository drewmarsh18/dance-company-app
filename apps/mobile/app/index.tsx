import { useEffect } from "react"
import { View, ActivityIndicator, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { useSession } from "@/lib/auth-client"
import { COLORS } from "@/constants/theme"

const API_BASE = "https://dance-company-app.vercel.app"

export default function Index() {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (isPending) return

    if (!session?.user) {
      router.replace("/(auth)/sign-in")
      return
    }

    // Fetch the user's role from the API
    fetch(`${API_BASE}/api/me`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .then((data) => {
        const role: string = data.role ?? "dancer"
        if (role === "admin") router.replace("/admin")
        else if (role === "prep_master") router.replace("/portal")
        else router.replace("/member")
      })
      .catch(() => {
        router.replace("/member")
      })
  }, [session, isPending])

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background },
})
