import { useEffect } from "react"
import { View, ActivityIndicator, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { authClient, useSession } from "@/lib/auth-client"
import { COLORS } from "@/constants/theme"

export default function Index() {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (isPending) return

    if (!session?.user) {
      router.replace("/(auth)/sign-in")
      return
    }

    // Use authClient.$fetch so the expo SecureStore session token is sent automatically
    authClient.$fetch("/api/me")
      .then(({ data, error }) => {
        if (error || !data) { router.replace("/member"); return }
        const role: string = (data as any).role ?? "dancer"
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
