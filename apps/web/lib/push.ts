import { db } from "@/lib/db"
import { pushToken } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

export type PushPayload = {
  title: string
  body: string
  data?: Record<string, unknown>
  categoryIdentifier?: string
}

/** Sends a push notification to every registered device for a user. Fire-and-forget safe. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const tokens = await db
    .select({ token: pushToken.token })
    .from(pushToken)
    .where(eq(pushToken.userId, userId))

  if (tokens.length === 0) return

  const messages = tokens.map(({ token }) => ({
    to: token,
    sound: "default" as const,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    categoryIdentifier: payload.categoryIdentifier,
  }))

  await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  })
}
