import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getPrepMaster, appBase, TABLES, type BookingFields } from "@/lib/airtable"
import { getAvailabilityForEmail } from "@/app/actions/availability"
import { buildWeekTemplate } from "@/lib/availability"
import { getCalendarBusyRange } from "@/lib/google-calendar"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { resolveRole } = await import("@/lib/roles")
  if ((await resolveRole(session.user.email)) === "prep_master") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const coach = await getPrepMaster(id)
  if (!coach) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    // Availability template
    const saved = await getAvailabilityForEmail(coach.email)
    const week = buildWeekTemplate(saved)

    // Booked slots for the next 28 days (one Airtable query, grouped by date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date(today)
    end.setDate(end.getDate() + 28)

    const toIso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

    const todayIso = toIso(today)
    const endIso = toIso(end)
    const safeName = coach.name.replace(/'/g, "\\'")

    const bookings = await appBase.list<BookingFields>(TABLES.bookings, {
      filterByFormula: `AND({Prep Master Name} = '${safeName}', {Date} >= '${todayIso}', {Date} <= '${endIso}')`,
      revalidate: 5,
    })

    const bookedSlots: Record<string, string[]> = {}
    for (const b of bookings) {
      const status = (b.fields.Status ?? "").toLowerCase()
      if (status.startsWith("cancelled")) continue
      const date = b.fields.Date ?? ""
      const time = b.fields.Time ?? ""
      if (!date || !time) continue
      if (!bookedSlots[date]) bookedSlots[date] = []
      bookedSlots[date].push(time)
    }

    // Merge Google Calendar busy slots so members can't book over the PM's existing events.
    // Single freebusy API call for the whole window instead of one call per day.
    const [pmUser] = await db
      .select({ id: userTable.id, timezone: userTable.timezone })
      .from(userTable)
      .where(eq(userTable.email, coach.email))
    if (pmUser) {
      const pmTimezone = pmUser.timezone ?? "America/New_York"
      const calBusy = await getCalendarBusyRange(pmUser.id, todayIso, endIso, 60, pmTimezone).catch(() => ({}))
      for (const [date, slots] of Object.entries(calBusy)) {
        if (!bookedSlots[date]) bookedSlots[date] = []
        for (const slot of slots) {
          if (!bookedSlots[date].includes(slot)) bookedSlots[date].push(slot)
        }
      }
    }

    const pmTimezone = pmUser?.timezone ?? "America/New_York"
    return NextResponse.json({ coach, week, bookedSlots, pmTimezone })
  } catch (err) {
    console.error("[coaches/[id]] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load availability" },
      { status: 500 },
    )
  }
}
