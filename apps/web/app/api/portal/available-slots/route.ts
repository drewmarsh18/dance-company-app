import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getPrepMasterByEmail, getBookedSlots, TABLES, appBase, type BookingFields } from "@/lib/airtable"
import { getAvailabilityForEmail } from "@/app/actions/availability"
import { slotsForDate } from "@/lib/availability"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")
  const excludeBookingId = searchParams.get("bookingId") ?? undefined

  if (!date) return NextResponse.json({ slots: [] })

  const pm = await getPrepMasterByEmail(session.user.email)
  if (!pm) return NextResponse.json({ slots: [] })

  const week = await getAvailabilityForEmail(pm.email)
  const allSlots = slotsForDate(date, week)
  if (allSlots.length === 0) return NextResponse.json({ slots: [] })

  const bookedSlots = await getBookedSlots(pm.name, date)

  let excludedTime: string | undefined
  if (excludeBookingId) {
    const safe = excludeBookingId.replace(/'/g, "\\'")
    const records = await appBase.list<BookingFields>(TABLES.bookings, {
      filterByFormula: `RECORD_ID() = '${safe}'`,
      maxRecords: 1,
    })
    excludedTime = records[0]?.fields.Time ?? undefined
  }

  const slots = allSlots.filter((s) => !bookedSlots.includes(s) || s === excludedTime)
  return NextResponse.json({ slots })
}
