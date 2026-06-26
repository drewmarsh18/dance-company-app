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
import { slotsForDate } from "@/lib/availability"
import { isWithin24Hours } from "@/lib/utils"
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
  status: string
  notes: string
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
    status: r.fields.Status ?? "Pending",
    notes: r.fields.Notes ?? "",
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
        const current = client.fields["Credits Remaining"] ?? 0
        await appBase.update<ClientFields>(TABLES.clients, client.id, {
          "Credits Remaining": current + 1,
        })

        // If credits were at 0, reactivate the most recently expired plan
        if (current === 0) {
          const inactivePlan = await getMostRecentInactivePlanForUser(user.id)
          if (inactivePlan) await setPlanStatus(inactivePlan.id, "Active")
        }
      }
    }

    const dateLabel = booking.fields.Date ?? "your session"
    const pmName = booking.fields["Prep Master Name"] ?? "your Prep Master"
    createNotification({
      userId: user.id,
      type: "booking_cancelled",
      title: "Booking cancelled",
      body: `Your session with ${pmName} on ${dateLabel} has been cancelled.${!within24 ? "" : " No credit was refunded (within 24 hours)."}`,
      bookingId,
    }).catch(() => {})

    if (user.email) {
      const { subject, html } = bookingCancelledEmail({
        dancerName: user.name ?? "Dancer",
        prepMasterName: pmName,
        date: booking.fields.Date ?? dateLabel,
        time: booking.fields.Time ?? "",
        creditRefunded: !within24,
      })
      sendEmail({ to: user.email, subject, html }).catch((e) => console.error("Cancel email failed:", e))
    }

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

    await appBase.update<BookingFields>(TABLES.bookings, bookingId, {
      Date: newDate,
      Time: newTime,
      Status: "Pending",
    })

    createNotification({
      userId: user.id,
      type: "booking_updated",
      title: "Booking rescheduled",
      body: `Your session with ${prepMasterName} has been moved to ${newDate} at ${newTime}.`,
      bookingId,
    }).catch(() => {})

    // Email both parties about the reschedule — fire and forget
    const memberName = user.name ?? user.email ?? "Your member"
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
    // Find prep master's email + userId to notify them (email + in-app)
    getPrepMasters().then(async (all) => {
      const pm = all.find((p) => p.name === prepMasterName)
      if (!pm?.email) return

      // In-app notification → prep master
      const [pmUser] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, pm.email))
      if (pmUser) {
        createNotification({
          userId: pmUser.id,
          type: "booking_updated",
          title: "Session rescheduled",
          body: `${memberName} has rescheduled their session to ${newDate} at ${newTime}.`,
          bookingId,
        }).catch(() => {})
      }

      // Email → prep master
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

    // 1) Credit gate — a booking costs 1 credit. Block when the dancer has none.
    const client = await findClientRecord(user.id)
    const credits = client?.fields["Credits Remaining"] ?? 0
    if (!client || credits < 1) {
      return {
        ok: false,
        error: "NO_CREDITS",
      }
    }

    // 2) Validate the slot is within the prep master's availability …
    const prepMaster = await getPrepMaster(input.prepMasterId)
    if (!prepMaster) {
      return { ok: false, error: "This Prep Master is no longer available." }
    }
    const week = await getAvailabilityForEmail(prepMaster.email)
    const openSlots = slotsForDate(input.date, week)
    if (!openSlots.includes(input.time)) {
      return {
        ok: false,
        error: "That time is outside this Prep Master's availability.",
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
      "User ID": user.id,
      "Client Email": user.email,
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

    // In-app notification for the dancer
    createNotification({
      userId: user.id,
      type: "booking_confirmed",
      title: "Booking confirmed",
      body: `Your session with ${input.prepMasterName} on ${input.date} at ${input.time} is confirmed.`,
      bookingId: record.id,
    }).catch(() => {})

    // Send booking confirmation email — fire and forget
    if (user.email) {
      const { subject, html } = bookingConfirmationEmail({
        dancerName: user.name ?? "Dancer",
        prepMasterName: input.prepMasterName,
        date: input.date,
        time: input.time,
      })
      sendEmail({ to: user.email, subject, html }).catch((e) => console.error("Confirmation email failed:", e))
    }

    // Email prep master with approve/deny links — fire and forget
    getPrepMaster(input.prepMasterId).then(async (pm) => {
      if (!pm?.email) return
      const approveUrl = `${APP_URL}/api/booking/confirm?id=${record.id}&action=approve&token=${CONFIRM_SECRET}`
      const denyUrl = `${APP_URL}/api/booking/confirm?id=${record.id}&action=deny&token=${CONFIRM_SECRET}`
      const { subject, html } = prepMasterBookingRequestEmail({
        prepMasterName: pm.name,
        dancerName: user.name ?? user.email ?? "A member",
        dancerEmail: user.email ?? "",
        date: input.date,
        time: input.time,
        notes: input.notes || undefined,
        approveUrl,
        denyUrl,
      })
      sendEmail({ to: pm.email, subject, html }).catch((e) => console.error("PM request email failed:", e))
    }).catch(() => {})

    // Create Google Calendar event on prep master's calendar — fire and forget
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

    // Notify prep master by SMS — fire and forget so a Twilio error never blocks the booking
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
