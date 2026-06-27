import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { googleCalendarToken } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

async function getAccessToken(userId: string): Promise<string | null> {
  const [row] = await db.select().from(googleCalendarToken).where(eq(googleCalendarToken.userId, userId))
  if (!row) return null
  if (row.expiresAt > new Date()) return row.accessToken
  // refresh
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: row.refreshToken,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  await db.update(googleCalendarToken).set({
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    updatedAt: new Date(),
  }).where(eq(googleCalendarToken.userId, userId))
  return data.access_token as string
}

// GET /api/portal/calendar-events?timeMin=...&timeMax=...
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const timeMin = searchParams.get("timeMin") ?? new Date().toISOString()
  const timeMax = searchParams.get("timeMax") ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const accessToken = await getAccessToken(session.user.id)
  if (!accessToken) return NextResponse.json({ connected: false, events: [] })

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  })
  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return NextResponse.json({ connected: true, events: [], error: "Failed to fetch calendar" })

  const data = await res.json()
  const events = (data.items ?? []).map((e: any) => ({
    id: e.id,
    title: e.summary ?? "(No title)",
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    allDay: !e.start?.dateTime,
    color: e.colorId ?? null,
  }))

  return NextResponse.json({ connected: true, events })
}
