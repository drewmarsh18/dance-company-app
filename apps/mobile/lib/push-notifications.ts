import * as Notifications from "expo-notifications"
import Constants from "expo-constants"
import { Platform } from "react-native"
import { authClient } from "@/lib/auth-client"

const API_BASE = "https://dance-company-app.vercel.app"

// How foreground notifications look
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/** Register notification categories with approve/deny actions for prep masters. */
export async function registerNotificationCategories() {
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
}

/** Request permission and register the Expo push token with the server. */
export async function registerForPushNotifications(): Promise<string | null> {
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
    Constants.expoConfig?.extra?.eas?.projectId
  if (!projectId) return null

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
  const token = tokenData.data

  // Send token to server
  await authClient.$fetch(`${API_BASE}/api/push-token`, {
    method: "POST",
    body: JSON.stringify({ token }),
    headers: { "Content-Type": "application/json" },
  })

  return token
}

/** Handle a notification action response (approve/deny booking). */
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
) {
  const actionId = response.actionIdentifier
  const data = response.notification.request.content.data as Record<string, unknown>

  if (
    actionId === "APPROVE" ||
    actionId === "DENY"
  ) {
    const url = actionId === "APPROVE"
      ? (data.approveUrl as string)
      : (data.denyUrl as string)

    if (!url) return

    try {
      await fetch(url)
    } catch {}
  }
}
