import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getPrepMasters } from "@/lib/airtable"
import { getAvailabilityForEmail } from "@/app/actions/availability"
import { buildWeekTemplate, hasAnyAvailability } from "@/lib/availability"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const coaches = await getPrepMasters()

  // Attach availability so mobile can filter out unavailable coaches
  const withAvail = await Promise.all(
    coaches.map(async (coach) => {
      const saved = await getAvailabilityForEmail(coach.email)
      const week = buildWeekTemplate(saved)
      return { ...coach, hasAvailability: hasAnyAvailability(week) }
    }),
  )

  return NextResponse.json({ coaches: withAvail })
}
