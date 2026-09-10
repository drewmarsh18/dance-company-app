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
  if (!row.refreshToken) return null
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

const SESSION_DURATION: Record<string, number> = {
  "private-30": 30,
  "private-45": 45,
  "private-60": 60,
  "pack-hour": 60,
}

/**
 * Returns time slots (in "H:MM AM/PM" format matching Airtable Time values) that are
 * blocked by existing Google Calendar events for the given user on a specific date.
 * Uses the freebusy API. Returns [] if calendar is not connected or the call fails.
 */
export async function getCalendarBusySlots(
  userId: string,
  dateIso: string, // YYYY-MM-DD in the PM's local date
  slotDurationMin = 60,
): Promise<string[]> {
  const accessToken = await getAccessToken(userId)
  if (!accessToken) return []

  // Query the full day in UTC (midnight-to-midnight covers all timezone offsets)
  const timeMin = new Date(`${dateIso}T00:00:00Z`).toISOString()
  const timeMax = new Date(`${dateIso}T23:59:59Z`).toISOString()

  const res = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    }),
  })
  if (!res.ok) return []

  const data = await res.json() as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } }
  const busy = data.calendars?.primary?.busy ?? []
  if (busy.length === 0) return []

  // Convert busy windows to the time-slot strings used in Airtable ("9:00 AM", "10:30 AM", etc.)
  const blocked: string[] = []
  for (const window of busy) {
    const windowStart = new Date(window.start).getTime()
    const windowEnd = new Date(window.end).getTime()
    // Walk every 30-minute slot across the day and mark it blocked if it overlaps the busy window
    for (let minuteOfDay = 0; minuteOfDay < 24 * 60; minuteOfDay += 30) {
      const slotStart = new Date(`${dateIso}T00:00:00Z`).getTime() + minuteOfDay * 60_000
      const slotEnd = slotStart + slotDurationMin * 60_000
      if (slotStart < windowEnd && slotEnd > windowStart) {
        const hour = Math.floor(minuteOfDay / 60)
        const min = minuteOfDay % 60
        const ampm = hour < 12 ? "AM" : "PM"
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        blocked.push(`${displayHour}:${String(min).padStart(2, "0")} ${ampm}`)
      }
    }
  }
  return [...new Set(blocked)]
}

export async function createCalendarEvent(
  userId: string,
  {
    dancerName,
    prepMasterName,
    date,
    time,
    notes,
    sessionType,
  }: { dancerName: string; prepMasterName?: string; date: string; time: string; notes?: string; sessionType?: string },
): Promise<void> {
  const accessToken = await getAccessToken(userId)
  if (!accessToken) return // calendar not connected — skip silently

  const durationMin = SESSION_DURATION[sessionType ?? "pack-hour"] ?? 60
  const start = new Date(`${date}T${time}:00`)
  const end = new Date(start.getTime() + durationMin * 60 * 1000)

  const summary = prepMasterName
    ? `CDP Session w/ ${prepMasterName}`
    : `CDP Session — ${dancerName}`

  const event = {
    summary,
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
