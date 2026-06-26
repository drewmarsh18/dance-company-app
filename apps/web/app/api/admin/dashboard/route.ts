import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { isAdminEmail } from "@/lib/roles"
import {
  adminGetAllMembers,
  adminGetAllBookings,
  adminGetAllWorkers,
  adminGetAllPlans,
  isAirtableConfigured,
} from "@/lib/airtable"
import { PACKAGES } from "@/lib/packages"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!isAirtableConfigured()) {
    return NextResponse.json({ error: "Airtable not configured" }, { status: 503 })
  }

  const [members, bookings, workers, plans] = await Promise.all([
    adminGetAllMembers(),
    adminGetAllBookings(),
    adminGetAllWorkers(),
    adminGetAllPlans(),
  ])

  return NextResponse.json({ members, bookings, workers, plans, packages: PACKAGES })
}
