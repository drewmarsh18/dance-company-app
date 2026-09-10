import Constants from "expo-constants"
import { Platform } from "react-native"
import { authClient } from "@/lib/auth-client"

const API_BASE = "https://app.collegedanceprep.com"

/** Register notification categories with approve/deny actions for prep masters. */
export async function registerNotificationCategories(): Promise<void> {
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
  if (finalStatus !== "granted") {
    throw new Error(`Notification permission not granted (status: ${finalStatus}). Enable in Settings > Notifications.`)
  }

  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as any)?.eas?.projectId
  if (!projectId) {
    throw new Error("No EAS projectId found in app config")
  }

  let token: string
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
    token = tokenData.data
  } catch (e: any) {
    throw new Error(`Failed to get push token from Expo: ${e?.message ?? String(e)}`)
  }

  const { error } = await authClient.$fetch(`${API_BASE}/api/push-token`, {
    method: "POST",
    body: JSON.stringify({ token }),
    headers: { "Content-Type": "application/json" },
  }) as { error?: any }

  if (error) {
    throw new Error(`Server rejected token: ${error?.message ?? error?.statusText ?? JSON.stringify(error)}`)
  }

  return token
}

/** Subscribe to notification action responses (approve/deny booking). */
export function addNotificationResponseListener(
  handler: (response: any) => void,
): { remove: () => void } {
  try {
    const Notifications = require("expo-notifications")
    return Notifications.addNotificationResponseReceivedListener(handler)
  } catch {
    return { remove: () => {} }
  }
}

/** Handle a notification tap or action response.
 *  Pass a `navigate` callback so the caller (RootLayout) can drive routing. */
export async function handleNotificationResponse(
  response: any,
  navigate?: (route: string) => void,
): Promise<void> {
  const actionId = response?.actionIdentifier
  const data = response?.notification?.request?.content?.data as Record<string, unknown> | undefined

  if (actionId === "APPROVE" || actionId === "DENY") {
    const url = actionId === "APPROVE"
      ? (data?.approveUrl as string)
      : (data?.denyUrl as string)
    if (!url) return
    try { await fetch(url) } catch {}
  } else if (navigate && data?.route) {
    // Default tap — go to the booking's home screen
    navigate(data.route as string)
  }
}
