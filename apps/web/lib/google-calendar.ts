import { db } from "@/lib/db"
import { googleCalendarToken } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

export function getCalendarAuthUrl(state: string, source?: "mobile") {
  const stateParam = source ? `${state}:${source}` : state
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google-calendar`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state: stateParam,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

async function refreshAccessToken(userId: string, refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) throw new Error("Failed to refresh Google token")
  const data = await res.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000)
  await db
    .update(googleCalendarToken)
    .set({ accessToken: data.access_token, expiresAt, updatedAt: new Date() })
    .where(eq(googleCalendarToken.userId, userId))
  return data.access_token as string
}

async function getAccessToken(userId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(googleCalendarToken)
    .where(eq(googleCalendarToken.userId, userId))
  if (!row) return null
  if (row.expiresAt > new Date()) return row.accessToken
  return refreshAccessToken(userId, row.refreshToken)
}

export async function isCalendarConnected(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: googleCalendarToken.id })
    .from(googleCalendarToken)
    .where(eq(googleCalendarToken.userId, userId))
  return !!row
}

export async function saveCalendarTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
) {
  const expiresAt = new Date(Date.now() + expiresIn * 1000)
  const id = crypto.randomUUID()
  await db
    .insert(googleCalendarToken)
    .values({ id, userId, accessToken, refreshToken, expiresAt })
    .onConflictDoUpdate({
      target: googleCalendarToken.userId,
      set: { accessToken, refreshToken, expiresAt, updatedAt: new Date() },
    })
}

export async function disconnectCalendar(userId: string) {
  await db.delete(googleCalendarToken).where(eq(googleCalendarToken.userId, userId))
}

export async function createCalendarEvent(
  prepMasterUserId: string,
  {
    dancerName,
    date,
    time,
    notes,
  }: { dancerName: string; date: string; time: string; notes?: string },
): Promise<void> {
  const accessToken = await getAccessToken(prepMasterUserId)
  if (!accessToken) return // calendar not connected — skip silently

  // Parse date + time into ISO start/end (1-hour sessions)
  const [hour, minute] = time.split(":").map(Number)
  const start = new Date(`${date}T${time}:00`)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  const event = {
    summary: `CDP Session — ${dancerName}`,
    description: notes ? `Notes: ${notes}` : "College Dance Prep private session",
    start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
    end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
  }

  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  })

  if (!res.ok) {
    console.error("Google Calendar event creation failed:", await res.text())
  }
}
