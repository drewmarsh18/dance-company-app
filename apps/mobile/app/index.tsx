import { useEffect } from "react"
import { View, ActivityIndicator, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { authClient, useSession } from "@/lib/auth-client"
import { useColors } from "@/lib/theme-context"

export default function Index() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const COLORS = useColors()

  useEffect(() => {
    if (isPending) return

    if (!session?.user) {
      router.replace("/(auth)/sign-in")
      return
    }

    authClient.$fetch("https://dance-company-app.vercel.app/api/me")
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
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  )
}
