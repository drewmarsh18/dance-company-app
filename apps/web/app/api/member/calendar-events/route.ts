import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { googleCalendarToken } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

async function getValidAccessToken(userId: string): Promise<string | null> {
  const [row] = await db.select().from(googleCalendarToken).where(eq(googleCalendarToken.userId, userId))
  if (!row) return null
  if (row.expiresAt > new Date()) return row.accessToken

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
  const expiresAt = new Date(Date.now() + data.expires_in * 1000)
  await db.update(googleCalendarToken).set({ accessToken: data.access_token, expiresAt, updatedAt: new Date() }).where(eq(googleCalendarToken.userId, userId))
  return data.access_token
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const accessToken = await getValidAccessToken(session.user.id)
  if (!accessToken) return NextResponse.json({ connected: false, events: [] })

  const timeMin = new Date().toISOString()
  const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days ahead

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events?` +
    new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "100" }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) return NextResponse.json({ connected: true, events: [] })
  const data = await res.json()

  const events = (data.items ?? []).map((e: any) => ({
    id: e.id,
    title: e.summary ?? "(No title)",
    start: e.start?.dateTime ?? e.start?.date ?? null,
    end: e.end?.dateTime ?? e.end?.date ?? null,
    allDay: !e.start?.dateTime,
    location: e.location ?? null,
  }))

  return NextResponse.json({ connected: true, events })
}
