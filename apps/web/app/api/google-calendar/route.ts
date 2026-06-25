import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getCalendarAuthUrl, disconnectCalendar } from "@/lib/google-calendar"

// GET /api/google-calendar — redirect to Google OAuth consent screen
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // state = userId so the callback knows who to save tokens for
  const url = getCalendarAuthUrl(session.user.id)
  return NextResponse.redirect(url)
}

// DELETE /api/google-calendar — disconnect calendar
export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await disconnectCalendar(session.user.id)
  return NextResponse.json({ ok: true })
}
