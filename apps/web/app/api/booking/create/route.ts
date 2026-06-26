import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import {
  TABLES, appBase,
  getPrepMaster,
  getPrepMasterPhone,
  getActivePlanForUser,
  setPlanStatus,
  getBookedSlots,
  type BookingFields,
  type ClientFields,
} from "@/lib/airtable"
import { getAvailabilityForEmail } from "@/app/actions/availability"
import { slotsForDate } from "@/lib/availability"
import { createNotification } from "@/app/actions/notifications"
import { sendEmail, bookingConfirmationEmail, prepMasterBookingRequestEmail } from "@/lib/email"
import { sendSms } from "@/lib/sms"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createCalendarEvent } from "@/lib/google-calendar"
import type { SessionType } from "@/lib/session-types"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dance-company-app.vercel.app"
const CONFIRM_SECRET = process.env.BOOKING_CONFIRM_SECRET ?? "cdp-confirm-secret"

async function findClientRecord(userId: string) {
  const safeId = userId.replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `{User ID} = '${safeId}'`,
    maxRecords: 1,
    revalidate: 0,
  })
  return records[0] ?? null
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = session.user
  const body = await req.json() as {
    prepMasterId: string
    prepMasterName: string
    date: string
    time: string
    notes?: string
    planId?: string
    planSessions?: number
    sessionType?: SessionType
  }

  const { prepMasterId, prepMasterName, date, time, notes, planId, planSessions, sessionType } = body

  // Credit gate
  const client = await findClientRecord(user.id)
  const credits = client?.fields["Credits Remaining"] ?? 0
  if (!client || credits < 1) {
    return NextResponse.json({ ok: false, error: "NO_CREDITS" })
  }

  // Validate slot is within availability
  const prepMaster = await getPrepMaster(prepMasterId)
  if (!prepMaster) {
    return NextResponse.json({ ok: false, error: "This Prep Master is no longer available." })
  }
  const week = await getAvailabilityForEmail(prepMaster.email)
  const openSlots = slotsForDate(date, week)
  if (!openSlots.includes(time)) {
    return NextResponse.json({ ok: false, error: "That time is outside this Prep Master's availability." })
  }

  // Prevent double-booking
  const booked = await getBookedSlots(prepMasterName, date)
  if (booked.includes(time)) {
    return NextResponse.json({ ok: false, error: "That time was just booked. Please choose another slot." })
  }

  // Create booking
  const record = await appBase.create<BookingFields>(TABLES.bookings, {
    "User ID": user.id,
    "Client Email": user.email,
    "Prep Master Name": prepMasterName,
    Date: date,
    Time: time,
    Status: "Pending",
    Notes: notes ?? "",
    "Session Type": sessionType ?? "pack-hour",
  })

  // Deduct credit
  const newCredits = credits - 1
  await appBase.update<ClientFields>(TABLES.clients, client.id, {
    "Credits Remaining": newCredits,
  })

  // Mark plan used if needed
  if (planId && planSessions === 1) {
    await setPlanStatus(planId, "Used")
  } else if (newCredits === 0) {
    const planToMark = planId ? { id: planId } : await getActivePlanForUser(user.id)
    if (planToMark) await setPlanStatus(planToMark.id, "Used")
  }

  // In-app notification
  createNotification({
    userId: user.id,
    type: "booking_confirmed",
    title: "Booking confirmed",
    body: `Your session with ${prepMasterName} on ${date} at ${time} is confirmed.`,
    bookingId: record.id,
  }).catch(() => {})

  const dancerDisplayName = client.fields.Name ?? user.name ?? "Dancer"

  // Emails — fire and forget
  if (user.email) {
    const { subject, html } = bookingConfirmationEmail({
      dancerName: dancerDisplayName,
      prepMasterName,
      date,
      time,
    })
    sendEmail({ to: user.email, subject, html }).catch(() => {})
  }

  getPrepMaster(prepMasterId).then(async (pm) => {
    if (!pm?.email) return
    const approveUrl = `${APP_URL}/api/booking/confirm?id=${record.id}&action=approve&token=${CONFIRM_SECRET}`
    const denyUrl = `${APP_URL}/api/booking/confirm?id=${record.id}&action=deny&token=${CONFIRM_SECRET}`
    const { subject, html } = prepMasterBookingRequestEmail({
      prepMasterName: pm.name,
      dancerName: dancerDisplayName,
      dancerEmail: user.email ?? "",
      date,
      time,
      notes: notes || undefined,
      approveUrl,
      denyUrl,
    })
    sendEmail({ to: pm.email, subject, html }).catch(() => {})

    const [pmUser] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, pm.email))
    if (pmUser) {
      createCalendarEvent(pmUser.id, {
        dancerName: user.name,
        date,
        time,
        notes,
      }).catch(() => {})
    }
  }).catch(() => {})

  getPrepMasterPhone(prepMasterId).then((phone) => {
    if (!phone) return
    const dateLabel = new Date(`${date} ${time}`).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    })
    sendSms(phone, `New booking! ${user.name} has booked a session with you on ${dateLabel} at ${time}. Log in to College Dance Prep to view details.`).catch(() => {})
  }).catch(() => {})

  return NextResponse.json({ ok: true, id: record.id })
}
