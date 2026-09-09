import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import {
  getPrepMasterByEmail, getBookingsForPrepMaster, getBookedSlots,
  TABLES, appBase, type BookingFields,
} from "@/lib/airtable"
import { getAvailabilityForEmail } from "@/app/actions/availability"
import { slotsForDate } from "@/lib/availability"
import { createNotification } from "@/app/actions/notifications"
import { etToUtcIso } from "@/lib/utils"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const prepMaster = await getPrepMasterByEmail(session.user.email)
  if (!prepMaster) return NextResponse.json({ error: "NO_RECORD" }, { status: 404 })

  const bookings = await getBookingsForPrepMaster(prepMaster.name)
  const seen = new Set<string>()
  const clients: { userId: string; name: string; email: string }[] = []
  for (const b of bookings) {
    const key = b.dancerEmail || b.userId
    if (!key || seen.has(key)) continue
    seen.add(key)
    clients.push({ userId: b.userId, name: b.dancerName || b.dancerEmail, email: b.dancerEmail })
  }

  return NextResponse.json({ clients: clients.sort((a, b) => a.name.localeCompare(b.name)) })
}


export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { dancerEmail, date, time, notes, sessionType } = await req.json() as {
    dancerEmail: string; date: string; time: string; notes?: string; sessionType?: string
  }

  const prepMaster = await getPrepMasterByEmail(session.user.email)
  if (!prepMaster) return NextResponse.json({ ok: false, error: "No PrepMaster record found." })

  const history = await getBookingsForPrepMaster(prepMaster.name)
  const knownEmails = new Set(history.map((b) => b.dancerEmail.toLowerCase()))
  if (!knownEmails.has(dancerEmail.toLowerCase())) {
    return NextResponse.json({ ok: false, error: "You can only book sessions for members you have previously worked with." })
  }

  const week = await getAvailabilityForEmail(prepMaster.email)
  const openSlots = slotsForDate(date, week)
  if (openSlots.length > 0 && !openSlots.includes(time)) {
    return NextResponse.json({ ok: false, error: "That time is outside your availability for that day." })
  }

  const booked = await getBookedSlots(prepMaster.name, date)
  if (booked.includes(time)) {
    return NextResponse.json({ ok: false, error: "That time slot is already booked." })
  }

  const [dancer] = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.email, dancerEmail.toLowerCase()))
    .limit(1)

  // Credit deduction for PM-scheduled sessions
  const CREDIT_COST: Record<string, number> = { "private-30": 0.5, "private-45": 0.75, "private-60": 1, "private-90": 1.5 }
  const creditCost = CREDIT_COST[sessionType ?? "private-60"] ?? 1
  if (dancer?.id) {
    const safeId = dancer.id.replace(/'/g, "\\'")
    const clientRecords = await appBase.list<{ "Credits Remaining": number; Name: string }>(
      TABLES.clients, { filterByFormula: `{User ID} = '${safeId}'`, maxRecords: 1, revalidate: 0 }
    )
    const clientRecord = clientRecords[0]
    if (clientRecord) {
      const current = (clientRecord.fields["Credits Remaining"] ?? 0) as number
      if (current < creditCost) {
        return NextResponse.json({ ok: false, error: "NO_CREDITS" })
      }
      await appBase.update(TABLES.clients, clientRecord.id, {
        "Credits Remaining": Math.round((current - creditCost) * 100) / 100,
      })
    }
  }

  const utcDatetime = etToUtcIso(date, time)
  await appBase.create<BookingFields>(TABLES.bookings, {
    "Client Email": dancerEmail,
    "User ID": dancer?.id ?? "",
    "Prep Master Name": prepMaster.name,
    Date: date,
    Time: time,
    ...(utcDatetime ? { "UTC Datetime": utcDatetime } : {}),
    Status: "Confirmed",
    Notes: notes ?? "",
    "Session Type": sessionType ?? "private-60",
  })

  if (dancer?.id) {
    createNotification({
      userId: dancer.id,
      type: "booking_confirmed",
      title: "Session booked",
      body: `${prepMaster.name} has booked a session with you on ${date} at ${time}.`,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
