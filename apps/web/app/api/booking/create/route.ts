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
import { fmtDate, fmtTime, etToUtcIso, fmtTimeForNotif, COMPANY_TZ } from "@/lib/utils"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createCalendarEvent, getCalendarBusySlots } from "@/lib/google-calendar"
import type { SessionType } from "@/lib/session-types"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dance-company-app.vercel.app"
const CONFIRM_SECRET = process.env.BOOKING_CONFIRM_SECRET ?? "cdp-confirm-secret"

async function findClientRecord(userId: string, parentEmail?: string | null) {
  const safeId = userId.replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `{User ID} = '${safeId}'`,
    maxRecords: 1,
    revalidate: 0,
  })
  if (records[0]) return records[0]
  // Parent view: look up child record by parent email
  if (parentEmail) {
    const safe = parentEmail.trim().toLowerCase().replace(/'/g, "\\'")
    const byParent = await appBase.list<ClientFields>(TABLES.clients, {
      filterByFormula: `LOWER({Parent Email}) = '${safe}'`,
      maxRecords: 1,
      revalidate: 0,
    })
    if (byParent[0]) return byParent[0]
  }
  return null
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
    utcDatetime?: string
    notes?: string
    planId?: string
    planSessions?: number
    sessionType?: SessionType
  }

  const { prepMasterId, prepMasterName, date, time, utcDatetime, notes, planId, planSessions, sessionType } = body

  // Credit cost based on session type
  const CREDIT_COST: Record<string, number> = {
    "pack-hour": 1,
    "private-60": 1,
    "private-45": 0.75,
    "private-30": 0.5,
    "private-90": 1.5,
  }
  const creditCost = CREDIT_COST[sessionType ?? "pack-hour"] ?? 1

  // Credit gate
  const client = await findClientRecord(user.id, user.email)
  const credits = client?.fields["Credits Remaining"] ?? 0
  if (!client || credits < creditCost) {
    return NextResponse.json({ ok: false, error: "NO_CREDITS" })
  }
  // For parent-view bookings, use the child's stored user ID and email
  const effectiveUserId = client.fields["User ID"] || user.id
  const effectiveEmail = client.fields.Email || user.email

  // Validate slot is within availability
  const prepMaster = await getPrepMaster(prepMasterId)
  if (!prepMaster) {
    return NextResponse.json({ ok: false, error: "This PrepMaster is no longer available." })
  }
  const week = await getAvailabilityForEmail(prepMaster.email)
  const openSlots = slotsForDate(date, week)
  if (!openSlots.includes(time)) {
    return NextResponse.json({ ok: false, error: "That time is outside this PrepMaster's availability." })
  }

  // Prevent double-booking
  const booked = await getBookedSlots(prepMasterName, date)
  if (booked.includes(time)) {
    return NextResponse.json({ ok: false, error: "That time was just booked. Please choose another slot." })
  }

  // Block if PM's Google Calendar shows a conflict
  const [pmUserRow] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, prepMaster.email))
  if (pmUserRow) {
    const busySlots = await getCalendarBusySlots(pmUserRow.id, date)
    if (busySlots.includes(time)) {
      return NextResponse.json({ ok: false, error: "That time is no longer available. Please choose another slot." })
    }
  }

  // Create booking
  const record = await appBase.create<BookingFields>(TABLES.bookings, {
    "User ID": effectiveUserId,
    "Client Email": effectiveEmail,
    "Prep Master Name": prepMasterName,
    Date: date,
    Time: time,
    ...(utcDatetime ? { "UTC Datetime": utcDatetime } : {}),
    Status: "Pending",
    Notes: notes ?? "",
    "Session Type": sessionType ?? "pack-hour",
  })

  // Deduct credit
  const newCredits = Math.round((credits - creditCost) * 100) / 100
  await appBase.update<ClientFields>(TABLES.clients, client.id, {
    "Credits Remaining": newCredits,
  })

  // Mark plan used if needed
  if (planId && planSessions === 1) {
    await setPlanStatus(planId, "Used")
  } else if (newCredits <= 0) {
    const planToMark = planId ? { id: planId } : await getActivePlanForUser(effectiveUserId)
    if (planToMark) await setPlanStatus(planToMark.id, "Used")
  }

  // Add to member's Google Calendar (fire and forget)
  createCalendarEvent(effectiveUserId, {
    dancerName: client.fields.Name ?? user.name ?? "Member",
    prepMasterName,
    date,
    time,
    notes,
    sessionType: sessionType ?? "pack-hour",
  }).catch(() => {})

  // Look up member timezone for notification body
  const [memberRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, effectiveUserId)).limit(1)
  const memberTz = memberRow?.timezone ?? null
  const utcForNotif = etToUtcIso(date, time, COMPANY_TZ)
  const memberTimeLabel = utcForNotif ? fmtTimeForNotif(utcForNotif, COMPANY_TZ, memberTz) : `${fmtTime(time)} ET`

  // In-app notification
  createNotification({
    userId: effectiveUserId,
    type: "booking_pending",
    title: "Booking requested",
    body: `Your session with ${prepMasterName} on ${fmtDate(date)} at ${memberTimeLabel} is pending confirmation.`,
    bookingId: record.id,
    pushData: { route: "/member/bookings" },
  }).catch(() => {})

  const dancerDisplayName = client.fields.Name ?? user.name ?? "Dancer"

  // Emails — fire and forget
  const parentEmailCC = client.fields["Parent Email"] || null
  if (effectiveEmail) {
    const { subject, html } = bookingConfirmationEmail({
      dancerName: dancerDisplayName,
      prepMasterName,
      date,
      time,
    })
    sendEmail({ to: effectiveEmail, subject, html, ...(parentEmailCC ? { cc: parentEmailCC } : {}) }).catch(() => {})
  }

  getPrepMaster(prepMasterId).then(async (pm) => {
    if (!pm?.email) return
    const approveUrl = `${APP_URL}/api/booking/confirm?id=${record.id}&action=approve&token=${CONFIRM_SECRET}`
    const denyUrl = `${APP_URL}/api/booking/confirm?id=${record.id}&action=deny&token=${CONFIRM_SECRET}`
    const { subject, html } = prepMasterBookingRequestEmail({
      prepMasterName: pm.name,
      dancerName: dancerDisplayName,
      dancerEmail: effectiveEmail ?? "",
      date,
      time,
      notes: notes || undefined,
      approveUrl,
      denyUrl,
    })
    sendEmail({ to: pm.email, subject, html }).catch(() => {})

    const [pmUser] = await db.select({ id: userTable.id, timezone: userTable.timezone }).from(userTable).where(eq(userTable.email, pm.email))
    if (pmUser) {
      // Push with approve/deny actions
      createNotification({
        userId: pmUser.id,
        type: "booking_request",
        title: "New session request",
        body: `${dancerDisplayName} wants to book ${fmtDate(date)} at ${utcForNotif ? fmtTimeForNotif(utcForNotif, COMPANY_TZ, pmUser?.timezone ?? null) : fmtTime(time)}.`,
        bookingId: record.id,
        pushCategory: "BOOKING_REQUEST",
        pushData: { bookingId: record.id, approveUrl, denyUrl },
      }).catch(() => {})

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

  return NextResponse.json({ ok: true, id: record.id, creditCost, newCredits })
}
