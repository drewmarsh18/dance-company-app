import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getCalendarAuthUrl } from "@/lib/google-calendar"

// GET /api/google-calendar/url — returns the Google OAuth URL as JSON (for mobile)
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = getCalendarAuthUrl(session.user.id, "mobile")
  return NextResponse.json({ url })
}
