import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getCachedPortalDashboard } from "@/lib/airtable-cache"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cached = await getCachedPortalDashboard(session.user.email)
  if (!cached) return NextResponse.json({ error: "NO_RECORD" }, { status: 404 })

  const { prepMaster, bookings } = cached
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isCancelled = (b: { status: string }) => b.status.toLowerCase().startsWith("cancelled") || b.status.toLowerCase() === "declined"

  const upcoming = bookings
    .filter((b) => !isCancelled(b) && (!b.date || new Date(`${b.date}T00:00:00`) >= today))
    .sort((a, b) => a.date.localeCompare(b.date))

  const completed = bookings
    .filter((b) => !isCancelled(b) && b.date && new Date(`${b.date}T00:00:00`) < today)
    .sort((a, b) => b.date.localeCompare(a.date))

  const cancelled = bookings.filter(isCancelled).sort((a, b) => b.date.localeCompare(a.date))

  return NextResponse.json({ prepMaster, upcoming, completed, cancelled })
}
