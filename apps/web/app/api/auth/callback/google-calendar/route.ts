import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { saveCalendarTokens } from "@/lib/google-calendar"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get("code")
  const rawState = searchParams.get("state") ?? ""
  const [userId, source, role] = rawState.split(":")
  const isMobile = source === "mobile"
  const mobileRole = role ?? "portal"

  if (!code || !userId) {
    if (isMobile) return NextResponse.redirect(`cdp://${mobileRole}/profile?calendar=error`)
    return NextResponse.redirect(new URL("/portal?calendar=error", req.url))
  }

  // Verify the authenticated session owns the userId in state — prevents IDOR token hijacking
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || session.user.id !== userId) {
    if (isMobile) return NextResponse.redirect(`cdp://${mobileRole}/profile?calendar=error`)
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
    if (isMobile) return NextResponse.redirect("cdp://portal/profile?calendar=error")
    return NextResponse.redirect(new URL("/portal?calendar=error", req.url))
  }

  const data = await res.json()
  await saveCalendarTokens(userId, data.access_token, data.refresh_token, data.expires_in)

  if (isMobile) return NextResponse.redirect(`cdp://${mobileRole}/profile?calendar=connected`)
  return NextResponse.redirect(new URL("/portal?calendar=connected", req.url))
}
