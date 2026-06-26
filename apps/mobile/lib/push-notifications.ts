import Constants from "expo-constants"
import { Platform, NativeModules } from "react-native"
import { authClient } from "@/lib/auth-client"

const API_BASE = "https://dance-company-app.vercel.app"

/** Returns true only when running in a native build with expo-notifications compiled in. */
function isAvailable(): boolean {
  return !!NativeModules.ExpoPushTokenManager
}

/** Register notification categories with approve/deny actions for prep masters. */
export async function registerNotificationCategories(): Promise<void> {
  if (!isAvailable()) return
  try {
    const Notifications = await import("expo-notifications")

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })

    await Notifications.setNotificationCategoryAsync("BOOKING_REQUEST", [
      {
        identifier: "APPROVE",
        buttonTitle: "Approve",
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
      {
        identifier: "DENY",
        buttonTitle: "Deny",
        options: { isDestructive: true, isAuthenticationRequired: false },
      },
    ])
  } catch {}
}

/** Request permission and register the Expo push token with the server. */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!isAvailable()) return null
  try {
    const Notifications = await import("expo-notifications")

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#e91e8c",
      })
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== "granted") return null

    const projectId =
      Constants.easConfig?.projectId ??
      (Constants.expoConfig?.extra as any)?.eas?.projectId
    if (!projectId) return null

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
    const token = tokenData.data

    await authClient.$fetch(`${API_BASE}/api/push-token`, {
      method: "POST",
      body: JSON.stringify({ token }),
      headers: { "Content-Type": "application/json" },
    })

    return token
  } catch {
    return null
  }
}

/** Subscribe to notification action responses (approve/deny booking). */
export function addNotificationResponseListener(
  handler: (response: any) => void,
): { remove: () => void } {
  if (!isAvailable()) return { remove: () => {} }
  try {
    const Notifications = require("expo-notifications")
    return Notifications.addNotificationResponseReceivedListener(handler)
  } catch {
    return { remove: () => {} }
  }
}

/** Handle a notification action response (approve/deny booking). */
export async function handleNotificationResponse(response: any): Promise<void> {
  const actionId = response?.actionIdentifier
  const data = response?.notification?.request?.content?.data as Record<string, unknown> | undefined

  if (actionId === "APPROVE" || actionId === "DENY") {
    const url = actionId === "APPROVE"
      ? (data?.approveUrl as string)
      : (data?.denyUrl as string)
    if (!url) return
    try { await fetch(url) } catch {}
  }
}
