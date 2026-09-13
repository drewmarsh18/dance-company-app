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
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy",
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

// Formats a UTC timestamp as an Airtable-style slot string ("10:00 AM", "1:30 PM")
// in the given timezone. Uses formatToParts to avoid the narrow no-break space
// (U+202F) that toLocaleTimeString inserts between digits and AM/PM in Node 18+.
function formatSlotInTz(utcMs: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(utcMs))
  const hour = parts.find((p) => p.type === "hour")?.value ?? "12"
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00"
  const period = (parts.find((p) => p.type === "dayPeriod")?.value ?? "AM").toUpperCase()
  return `${hour}:${minute} ${period}`
}

// Converts busy windows from Google (UTC ISO strings) to Airtable-style time slot strings
// ("9:00 AM", "1:30 PM", etc.) in the PrepMaster's local timezone.
// Slots are 30-min aligned; a slot is blocked if it overlaps the busy window by any amount.
function busyWindowsToSlots(
  busy: { start: string; end: string }[],
  dateIso: string,
  slotDurationMin: number,
  timezone: string,
): string[] {
  const blocked = new Set<string>()
  // UTC ms for the start of this date — used as anchor; we walk ±24h to cover all tz offsets
  const dayUtcMs = new Date(`${dateIso}T00:00:00Z`).getTime()

  for (const window of busy) {
    const windowStart = new Date(window.start).getTime()
    const windowEnd = new Date(window.end).getTime()
    // Walk every 30-min UTC increment across the full ±24h window around this date
    for (let offsetMin = -24 * 60; offsetMin < 48 * 60; offsetMin += 30) {
      const slotStartMs = dayUtcMs + offsetMin * 60_000
      const slotEndMs = slotStartMs + slotDurationMin * 60_000
      if (slotStartMs >= windowEnd || slotEndMs <= windowStart) continue
      // Check if this UTC instant falls on the correct local date
      const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(slotStartMs))
      if (localDate !== dateIso) continue
      blocked.add(formatSlotInTz(slotStartMs, timezone))
    }
  }
  return [...blocked]
}

/**
 * Returns time slots (in "H:MM AM/PM" format matching Airtable Time values) that are
 * blocked by existing Google Calendar events for the given user on a specific date.
 * Uses the freebusy API. Returns [] if calendar is not connected or the call fails.
 */
export async function getCalendarBusySlots(
  userId: string,
  dateIso: string,
  slotDurationMin = 60,
  timezone = "America/New_York",
): Promise<string[]> {
  const accessToken = await getAccessToken(userId)
  if (!accessToken) return []

  const timeMin = new Date(`${dateIso}T00:00:00Z`).toISOString()
  const timeMax = new Date(`${dateIso}T23:59:59Z`).toISOString()

  const res = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: "primary" }] }),
  })
  if (!res.ok) return []

  const data = await res.json() as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } }
  return busyWindowsToSlots(data.calendars?.primary?.busy ?? [], dateIso, slotDurationMin, timezone)
}

/**
 * Fetches busy slots for a date range in a single freebusy API call.
 * Returns a map of { [dateIso]: string[] } for every date that has blocked slots.
 * Much more efficient than calling getCalendarBusySlots per day.
 */
export async function getCalendarBusyRange(
  userId: string,
  startIso: string,
  endIso: string,
  slotDurationMin = 60,
  timezone = "America/New_York",
): Promise<Record<string, string[]>> {
  const accessToken = await getAccessToken(userId)
  if (!accessToken) return {}

  const timeMin = new Date(`${startIso}T00:00:00Z`).toISOString()
  const timeMax = new Date(`${endIso}T23:59:59Z`).toISOString()

  const res = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: "primary" }] }),
  })
  if (!res.ok) return {}

  const data = await res.json() as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } }
  const busy = data.calendars?.primary?.busy ?? []
  if (busy.length === 0) return {}

  // Group busy windows by date (in the PM's local timezone), then convert to slot strings.
  // A window that spans midnight local time needs to appear on both dates.
  const byDate: Record<string, { start: string; end: string }[]> = {}
  for (const window of busy) {
    const windowEndMs = new Date(window.end).getTime()
    const cur = new Date(window.start)
    cur.setUTCHours(0, 0, 0, 0)
    while (cur.getTime() < windowEndMs) {
      const utcDateIso = cur.toISOString().slice(0, 10)
      // Check the local date on both sides of UTC midnight to handle timezone offsets
      const localDates = new Set([
        utcDateIso,
        new Date(cur.getTime() - 14 * 3600_000).toLocaleDateString("en-CA", { timeZone: timezone }),
        new Date(cur.getTime() + 14 * 3600_000).toLocaleDateString("en-CA", { timeZone: timezone }),
      ])
      for (const dateIso of localDates) {
        if (!byDate[dateIso]) byDate[dateIso] = []
        if (!byDate[dateIso].includes(window)) byDate[dateIso].push(window)
      }
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
  }

  const result: Record<string, string[]> = {}
  for (const [dateIso, windows] of Object.entries(byDate)) {
    const slots = busyWindowsToSlots(windows, dateIso, slotDurationMin, timezone)
    if (slots.length > 0) result[dateIso] = slots
  }
  return result
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
