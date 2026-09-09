import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { unstable_cache } from "next/cache"
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

const getCachedAdminDashboard = unstable_cache(
  async () => {
    // Sequential to avoid bursting Airtable's rate limit on cold starts
    const members = await adminGetAllMembers()
    const bookings = await adminGetAllBookings()
    const workers = await adminGetAllWorkers()
    const plans = await adminGetAllPlans()
    return { members, bookings, workers, plans }
  },
  ["admin-dashboard"],
  { revalidate: 0, tags: ["admin"] },
)

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!isAirtableConfigured()) {
    return NextResponse.json({ error: "Airtable not configured" }, { status: 503 })
  }

  try {
    const { members, bookings, workers, plans } = await getCachedAdminDashboard()

    return NextResponse.json({ members, bookings, workers, plans, packages: PACKAGES })
  } catch (err) {
    console.error("[admin/dashboard] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load dashboard" },
      { status: 500 },
    )
  }
}
