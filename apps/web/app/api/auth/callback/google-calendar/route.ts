import { NextRequest, NextResponse } from "next/server"
import { saveCalendarTokens } from "@/lib/google-calendar"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get("code")
  const userId = searchParams.get("state")

  if (!code || !userId) {
    return NextResponse.redirect(new URL("/portal?calendar=error", req.url))
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google-calendar`,
      grant_type: "authorization_code",
    }),
  })

  if (!res.ok) {
    console.error("Token exchange failed:", await res.text())
    return NextResponse.redirect(new URL("/portal?calendar=error", req.url))
  }

  const data = await res.json()
  await saveCalendarTokens(userId, data.access_token, data.refresh_token, data.expires_in)

  return NextResponse.redirect(new URL("/portal?calendar=connected", req.url))
}
