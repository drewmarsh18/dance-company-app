import { useEffect, useRef } from "react"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as WebBrowser from "expo-web-browser"
import * as Notifications from "expo-notifications"
import {
  registerForPushNotifications,
  registerNotificationCategories,
  handleNotificationResponse,
} from "@/lib/push-notifications"
import { useSession } from "@/lib/auth-client"

// Must be called at the root level so OAuth deep-link callbacks are
// intercepted here before Expo Router tries to match them as routes.
WebBrowser.maybeCompleteAuthSession()

export default function RootLayout() {
  const { data: session } = useSession()
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    registerNotificationCategories()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    registerForPushNotifications().catch(() => {})
  }, [session?.user?.id])

  useEffect(() => {
    // Handle tapping a notification or its action buttons
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    )
    return () => responseListenerRef.current?.remove()
  }, [])

  return (
    <>
      <StatusBar style="dark" />
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
