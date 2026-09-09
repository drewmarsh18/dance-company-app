"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import {
  TABLES,
  appBase,
  getPrepMaster,
  getPrepMasterPhone,
  getPrepMasters,
  getBookedSlots,
  getActivePlanForUser,
  getMostRecentInactivePlanForUser,
  setPlanStatus,
  type BookingFields,
  type ClientFields,
} from "@/lib/airtable"
import { sendSms } from "@/lib/sms"
import { createNotification } from "@/app/actions/notifications"
import { createCalendarEvent } from "@/lib/google-calendar"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getAvailabilityForEmail } from "@/app/actions/availability"
import { resolveClientProfile } from "@/lib/profile-core"
import { slotsForDate } from "@/lib/availability"
import { isWithin24Hours, fmtDate, fmtTime, etToUtcIso, fmtTimeForNotif, COMPANY_TZ } from "@/lib/utils"
import { sendEmail, bookingConfirmationEmail, bookingCancelledEmail, prepMasterBookingRequestEmail, bookingUpdatedEmail } from "@/lib/email"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dance-company-app.vercel.app"
const CONFIRM_SECRET = process.env.BOOKING_CONFIRM_SECRET ?? "cdp-confirm-secret"

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user
}

export type Booking = {
  id: string
  prepMasterName: string
  date: string
  time: string
  utcDatetime: string | null
  status: string
  notes: string
  prepMasterNotes: string
  sessionType: string | null
}

export async function getMyBookings(): Promise<Booking[]> {
  const user = await getSessionUser()
  return getBookingsForUserId(user.id)
}

export async function getBookingsForUserId(userId: string): Promise<Booking[]> {
  const safeId = userId.replace(/'/g, "\\'")
  const records = await appBase.list<BookingFields>(TABLES.bookings, {
    filterByFormula: `{User ID} = '${safeId}'`,
    sort: [{ field: "Date", direction: "desc" }],
    revalidate: 0,
  })
  return records.map((r) => ({
    id: r.id,
    prepMasterName: r.fields["Prep Master Name"] ?? "",
    date: r.fields.Date ?? "",
    time: r.fields.Time ?? "",
    utcDatetime: r.fields["UTC Datetime"] ?? null,
    status: r.fields.Status ?? "Pending",
    notes: r.fields.Notes ?? "",
    prepMasterNotes: r.fields["Prep Master Notes"] ?? "",
    sessionType: (r.fields["Session Type"] as string) ?? null,
  }))
}

// Finds the dancer's Member record (or null) by their auth user id.
async function findClientRecord(userId: string) {
  const safeId = userId.replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `{User ID} = '${safeId}'`,
    maxRecords: 1,
    revalidate: 0,
  })
  return records[0] ?? null
}

export async function cancelBooking(
  bookingId: string,
): Promise<{ ok: true; creditRefunded: boolean } | { ok: false; error: string }> {
  try {
    const user = await getSessionUser()
    const safeId = user.id.replace(/'/g, "\\'")
    const records = await appBase.list<BookingFields>(TABLES.bookings, {
      filterByFormula: `AND({User ID} = '${safeId}', RECORD_ID() = '${bookingId}')`,
      maxRecords: 1,
    })
    if (!records[0]) return { ok: false, error: "Booking not found." }

    const booking = records[0]
    const within24 = isWithin24Hours(booking.fields.Date ?? "", booking.fields.Time ?? "")

    await appBase.update<BookingFields>(TABLES.bookings, bookingId, {
      Status: within24 ? "Cancelled (Late)" : "Cancelled",
    })

    // Refund credit only when cancelled outside the 24-hour window
    if (!within24) {
      const client = await findClientRecord(user.id)
      if (client) {
        const SESSION_CREDIT_COST: Record<string, number> = { "pack-hour": 1, "private-60": 1, "private-45": 0.75, "private-30": 0.5, "private-90": 1.5 }
        const sessionType = booking.fields["Session Type"] ?? "private-60"
        const creditRefund = SESSION_CREDIT_COST[sessionType] ?? 1
        const current = client.fields["Credits Remaining"] ?? 0
        await appBase.update<ClientFields>(TABLES.clients, client.id, {
          "Credits Remaining": Math.round((current + creditRefund) * 100) / 100,
        })

        // If credits were at 0, reactivate the most recently expired plan
        if (current === 0) {
          const inactivePlan = await getMostRecentInactivePlanForUser(user.id)
          if (inactivePlan) await setPlanStatus(inactivePlan.id, "Active")
        }
      }
    }

    const dateLabel = fmtDate(booking.fields.Date ?? "") || "your session"
    const pmName = booking.fields["Prep Master Name"] ?? "your PrepMaster"
    const cancelledTime = booking.fields.Time ?? ""
    const clientRecord = await findClientRecord(user.id)
    const memberName = clientRecord?.fields.Name ?? user.name ?? user.email ?? "A member"

    // Notify the member
    createNotification({
      userId: user.id,
      type: "booking_cancelled",
      title: "Booking cancelled",
      body: `Your session with ${pmName} on ${dateLabel} has been cancelled.${!within24 ? "" : " No credit was refunded (within 24 hours)."}`,
      bookingId,
      pushData: { route: "/member/bookings" },
    }).catch(() => {})

    if (user.email) {
      const { subject, html } = bookingCancelledEmail({
        dancerName: user.name ?? "Dancer",
        prepMasterName: pmName,
        date: booking.fields.Date ?? dateLabel,
        time: cancelledTime,
        creditRefunded: !within24,
      })
      sendEmail({ to: user.email, subject, html }).catch((e) => console.error("Cancel email failed:", e))
    }

    // Notify the PrepMaster
    getPrepMasters().then(async (all) => {
      const pm = all.find((p) => p.name === pmName)
      if (!pm?.email) return
      const [pmUser] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, pm.email))
      if (pmUser) {
        createNotification({
          userId: pmUser.id,
          type: "booking_cancelled",
          title: "Session cancelled",
          body: `${memberName} cancelled their session on ${dateLabel}${within24 ? " (within 24 hours — payable)" : ""}.`,
          bookingId,
          pushData: { route: "/portal" },
        }).catch(() => {})
      }
      const { subject, html } = bookingCancelledEmail({
        dancerName: memberName,
        prepMasterName: pm.name,
        date: booking.fields.Date ?? dateLabel,
        time: cancelledTime,
        creditRefunded: false,
      })
      sendEmail({ to: pm.email, subject, html }).catch(() => {})
    }).catch(() => {})

    revalidatePath("/dashboard")
    return { ok: true, creditRefunded: !within24 }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to cancel." }
  }
}

export async function rescheduleBooking(
  bookingId: string,
  newDate: string,
  newTime: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getSessionUser()
    const safeId = user.id.replace(/'/g, "\\'")
    const records = await appBase.list<BookingFields>(TABLES.bookings, {
      filterByFormula: `AND({User ID} = '${safeId}', RECORD_ID() = '${bookingId}')`,
      maxRecords: 1,
    })
    const existing = records[0]
    if (!existing) return { ok: false, error: "Booking not found." }

    if (isWithin24Hours(existing.fields.Date ?? "", existing.fields.Time ?? "")) {
      return { ok: false, error: "Bookings within 24 hours cannot be rescheduled." }
    }

    const prepMasterName = existing.fields["Prep Master Name"] ?? ""
    const booked = await getBookedSlots(prepMasterName, newDate)
    if (booked.includes(newTime)) {
      return { ok: false, error: "That time slot is already taken." }
    }

    // Look up the PrepMaster's timezone for correct UTC conversion
    const pmReschByName = (await getPrepMasters()).find((p) => p.name === prepMasterName)
    const [pmReschTzRow] = pmReschByName?.email
      ? await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.email, pmReschByName.email)).limit(1)
      : [undefined]
    const pmReschTz = pmReschTzRow?.timezone ?? COMPANY_TZ

    await appBase.update<BookingFields>(TABLES.bookings, bookingId, {
      Date: newDate,
      Time: newTime,
      Status: "Pending",
    })

    // Tell the member their request is pending — not confirmed yet
    const utcForReschedule = etToUtcIso(newDate, newTime, pmReschTz)
    const [memberReschRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, user.id)).limit(1)
    const memberReschTz = memberReschRow?.timezone ?? null
    const memberReschLabel = utcForReschedule ? fmtTimeForNotif(utcForReschedule, pmReschTz, memberReschTz) : fmtTime(newTime)
    createNotification({
      userId: user.id,
      type: "booking_updated",
      title: "Reschedule requested",
      body: `Your reschedule request for ${fmtDate(newDate)} at ${memberReschLabel} is awaiting approval from ${prepMasterName}.`,
      bookingId,
      pushData: { route: "/member/bookings" },
    }).catch(() => {})

    // Email both parties about the reschedule — fire and forget
    const clientRecord = await findClientRecord(user.id)
    const memberName = clientRecord?.fields.Name ?? user.name ?? user.email ?? "Your member"
    const existingNotes = existing.fields.Notes || undefined
    if (user.email) {
      const { subject, html } = bookingUpdatedEmail({
        recipientName: memberName,
        updatedByName: memberName,
        updatedByRole: "member",
        date: newDate,
        time: newTime,
        notes: existingNotes,
      })
      sendEmail({ to: user.email, subject, html }).catch((e) => console.error("Reschedule email to member failed:", e))
    }
    // Find PrepMaster's email + userId to notify them (email + in-app)
    getPrepMasters().then(async (all) => {
      const pm = all.find((p) => p.name === prepMasterName)
      if (!pm?.email) return

      // In-app notification → PrepMaster (needs their approval)
      const [pmUser] = await db.select({ id: userTable.id, timezone: userTable.timezone }).from(userTable).where(eq(userTable.email, pm.email))
      if (pmUser) {
        const pmReschLabel = utcForReschedule ? fmtTimeForNotif(utcForReschedule, pmReschTz, pmUser.timezone ?? null) : fmtTime(newTime)
        createNotification({
          userId: pmUser.id,
          type: "booking_updated",
          title: "Reschedule request",
          body: `${memberName} wants to reschedule to ${fmtDate(newDate)} at ${pmReschLabel}. Please approve or decline.`,
          bookingId,
          pushData: { route: "/portal" },
        }).catch(() => {})
      }

      // Email → PrepMaster
      const { subject, html } = bookingUpdatedEmail({
        recipientName: pm.name,
        updatedByName: memberName,
        updatedByRole: "member",
        date: newDate,
        time: newTime,
        notes: existingNotes,
      })
      sendEmail({ to: pm.email, subject, html }).catch((e) => console.error("Reschedule email to PM failed:", e))
    }).catch(() => {})

    revalidatePath("/dashboard")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to reschedule." }
  }
}

export async function createBooking(input: {
  prepMasterId: string
  prepMasterName: string
  date: string
  time: string
  notes?: string
  planId?: string
  planSessions?: number
  sessionType?: import("@/lib/session-types").SessionType
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const user = await getSessionUser()

    // Resolve effective profile — parent accounts proxy to the child's record
    const profile = await resolveClientProfile({ id: user.id, email: user.email, name: user.name ?? "" }, true)
    const effectiveUserId = profile.effectiveUserId || user.id
    const effectiveEmail = profile.email || user.email

    // 1) Credit gate — a booking costs 1 credit. Block when the dancer has none.
    const client = await findClientRecord(effectiveUserId)
    const credits = client?.fields["Credits Remaining"] ?? 0
    if (!client || credits < 1) {
      return {
        ok: false,
        error: "NO_CREDITS",
      }
    }

    // 2) Validate the slot is within the PrepMaster's availability …
    const prepMaster = await getPrepMaster(input.prepMasterId)
    if (!prepMaster) {
      return { ok: false, error: "This PrepMaster is no longer available." }
    }
    const [pmTzRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.email, prepMaster.email)).limit(1)
    const pmTz = pmTzRow?.timezone ?? COMPANY_TZ
    const week = await getAvailabilityForEmail(prepMaster.email)
    const openSlots = slotsForDate(input.date, week)
    if (!openSlots.includes(input.time)) {
      return {
        ok: false,
        error: "That time is outside this PrepMaster's availability.",
      }
    }

    // 3) … and not already taken (prevent double-booking).
    const booked = await getBookedSlots(input.prepMasterName, input.date)
    if (booked.includes(input.time)) {
      return {
        ok: false,
        error: "That time was just booked. Please choose another slot.",
      }
    }

    // 4) Create the booking, then deduct one credit.
    const record = await appBase.create<BookingFields>(TABLES.bookings, {
      "User ID": effectiveUserId,
      "Client Email": effectiveEmail,
      "Prep Master Name": input.prepMasterName,
      Date: input.date,
      Time: input.time,
      Status: "Pending",
      Notes: input.notes ?? "",
      "Session Type": input.sessionType ?? "pack-hour",
    })

    const newCredits = credits - 1
    await appBase.update<ClientFields>(TABLES.clients, client.id, {
      "Credits Remaining": newCredits,
    })

    // Mark the used plan as Used:
    // - Single-session plans (sessions=1): mark immediately
    // - Pack plans: mark when credits hit 0
    if (input.planId && input.planSessions === 1) {
      await setPlanStatus(input.planId, "Used")
    } else if (newCredits === 0) {
      const planToMark = input.planId ? { id: input.planId } : await getActivePlanForUser(user.id)
      if (planToMark) await setPlanStatus(planToMark.id, "Used")
    }

    // In-app notification for the dancer (use effectiveUserId so it goes to the child, not the parent)
    const utcForCreate = etToUtcIso(input.date, input.time, pmTz)
    const [memberCreateRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, effectiveUserId)).limit(1)
    const memberCreateLabel = utcForCreate ? fmtTimeForNotif(utcForCreate, pmTz, memberCreateRow?.timezone ?? null) : fmtTime(input.time)
    createNotification({
      userId: effectiveUserId,
      type: "booking_confirmed",
      title: "Booking confirmed",
      body: `Your session with ${input.prepMasterName} on ${fmtDate(input.date)} at ${memberCreateLabel} is confirmed.`,
      bookingId: record.id,
      pushData: { route: "/member/bookings" },
    }).catch(() => {})

    const dancerDisplayName = client.fields.Name ?? user.name ?? "Dancer"

    // Send booking confirmation email to the child's email (and cc parent if booking on their behalf)
    const confirmationRecipients: string[] = []
    if (effectiveEmail) confirmationRecipients.push(effectiveEmail)
    if (profile.isParentView && user.email && user.email !== effectiveEmail) confirmationRecipients.push(user.email)
    if (confirmationRecipients.length > 0) {
      const { subject, html } = bookingConfirmationEmail({
        dancerName: dancerDisplayName,
        prepMasterName: input.prepMasterName,
        date: input.date,
        time: input.time,
      })
      sendEmail({ to: confirmationRecipients, subject, html }).catch((e) => console.error("Confirmation email failed:", e))
    }

    // Email + push notification to PrepMaster with approve/deny — fire and forget
    getPrepMaster(input.prepMasterId).then(async (pm) => {
      if (!pm?.email) return
      const approveUrl = `${APP_URL}/api/booking/confirm?id=${record.id}&action=approve&token=${CONFIRM_SECRET}`
      const denyUrl = `${APP_URL}/api/booking/confirm?id=${record.id}&action=deny&token=${CONFIRM_SECRET}`
      const { subject, html } = prepMasterBookingRequestEmail({
        prepMasterName: pm.name,
        dancerName: dancerDisplayName,
        dancerEmail: effectiveEmail ?? "",
        date: input.date,
        time: input.time,
        notes: input.notes || undefined,
        approveUrl,
        denyUrl,
      })
      sendEmail({ to: pm.email, subject, html }).catch((e) => console.error("PM request email failed:", e))

      // Push notification with approve/deny actions
      const [pmUser] = await db.select({ id: userTable.id, timezone: userTable.timezone }).from(userTable).where(eq(userTable.email, pm.email))
      if (pmUser) {
        const pmCreateLabel = utcForCreate ? fmtTimeForNotif(utcForCreate, pmTz, pmUser.timezone ?? null) : fmtTime(input.time)
        createNotification({
          userId: pmUser.id,
          type: "booking_request",
          title: "New session request",
          body: `${dancerDisplayName} wants to book ${fmtDate(input.date)} at ${pmCreateLabel}.`,
          bookingId: record.id,
          pushCategory: "BOOKING_REQUEST",
          pushData: {
            bookingId: record.id,
            approveUrl,
            denyUrl,
            route: "/portal",
          },
        }).catch(() => {})
      }
    }).catch(() => {})

    // Create Google Calendar event on PrepMaster's calendar — fire and forget
    getPrepMaster(input.prepMasterId).then(async (pm) => {
      if (!pm?.email) return
      const [pmUser] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, pm.email))
      if (!pmUser) return
      createCalendarEvent(pmUser.id, {
        dancerName: user.name,
        date: input.date,
        time: input.time,
        notes: input.notes,
      }).catch((e) => console.error("Calendar event failed:", e))
    }).catch(() => {})

    // Notify PrepMaster by SMS — fire and forget so a Twilio error never blocks the booking
    getPrepMasterPhone(input.prepMasterId).then((phone) => {
      if (!phone) return
      const dateLabel = new Date(`${input.date} ${input.time}`).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      })
      sendSms(
        phone,
        `New booking! ${user.name} has booked a session with you on ${dateLabel} at ${input.time}. Log in to College Dance Prep to view details.`,
      ).catch((e) => console.error("SMS failed:", e))
    })

    revalidatePath("/dashboard")
    return { ok: true, id: record.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create booking"
    return { ok: false, error: message }
  }
}
