import { useEffect, useRef } from "react"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as WebBrowser from "expo-web-browser"
import {
  registerForPushNotifications,
  registerNotificationCategories,
  addNotificationResponseListener,
  handleNotificationResponse,
} from "@/lib/push-notifications"
import { useSession } from "@/lib/auth-client"
import { ThemeProvider, useTheme } from "@/lib/theme-context"

WebBrowser.maybeCompleteAuthSession()

function RootLayoutInner() {
  const { data: session } = useSession()
  const { isDark } = useTheme()
  const listenerRef = useRef<{ remove: () => void } | null>(null)

  useEffect(() => {
    registerNotificationCategories()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    registerForPushNotifications().catch(() => {})
  }, [session?.user?.id])

  useEffect(() => {
    listenerRef.current = addNotificationResponseListener(handleNotificationResponse)
    return () => listenerRef.current?.remove()
  }, [])

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="member" />
        <Stack.Screen name="portal" />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  )
}
