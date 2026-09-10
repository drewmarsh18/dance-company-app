"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { getSessionUserWithRole } from "@/lib/roles"
import { TABLES, appBase, getPrepMasterByEmail, getBookedSlots, type BookingFields, type ClientFields } from "@/lib/airtable"
import { sendEmail, bookingUpdatedEmail, bookingCancelledEmail } from "@/lib/email"
import { createNotification } from "@/app/actions/notifications"
import { fmtDate, fmtTime, etToUtcIso, fmtTimeForNotif, COMPANY_TZ } from "@/lib/utils"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getAvailabilityForEmail } from "@/app/actions/availability"
import { slotsForDate } from "@/lib/availability"

async function assertPrepMaster() {
  const user = await getSessionUserWithRole()
  if (!user || (user.role !== "prep_master" && user.role !== "admin")) throw new Error("Unauthorized")
  return user
}

async function getUserIdByEmail(email: string): Promise<string | null> {
  const [row] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, email))
  return row?.id ?? null
}

/**
 * Returns available (unbooked) time slots for the authenticated PM on a given date.
 * Pass `excludeBookingId` to allow the current booking's slot to remain selectable.
 */
export async function getAvailableSlotsForDate(
  date: string,
  excludeBookingId?: string,
): Promise<string[]> {
  try {
    const user = await assertPrepMaster()
    const pm = await getPrepMasterByEmail(user.email)
    if (!pm) return []

    const week = await getAvailabilityForEmail(pm.email)
    const allSlots = slotsForDate(date, week)
    if (allSlots.length === 0) return []

    const bookedSlots = await getBookedSlots(pm.name, date)

    // Exclude already-booked slots, but keep the current booking's slot available
    let excludedTime: string | undefined
    if (excludeBookingId) {
      const safeId = excludeBookingId.replace(/'/g, "\\'")
      const records = await appBase.list<BookingFields>(TABLES.bookings, {
        filterByFormula: `RECORD_ID() = '${safeId}'`,
        maxRecords: 1,
      })
      excludedTime = records[0]?.fields.Time ?? undefined
    }

    return allSlots.filter((slot) => !bookedSlots.includes(slot) || slot === excludedTime)
  } catch {
    return []
  }
}

export async function confirmBooking(
  bookingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await assertPrepMaster()
    const pm = await getPrepMasterByEmail(user.email)
    if (!pm) return { ok: false, error: "Staff record not found." }

    const records = await appBase.list<BookingFields>(TABLES.bookings, {
      filterByFormula: `AND({Prep Master Name} = '${pm.name.replace(/'/g, "\\'")}', RECORD_ID() = '${bookingId}')`,
      maxRecords: 1,
    })
    if (!records[0]) return { ok: false, error: "Booking not found." }

    await appBase.update<BookingFields>(TABLES.bookings, bookingId, { Status: "Confirmed" })

    // Notify member in-app
    const dancerUserId = records[0].fields["User ID"]
    const confirmDate = records[0].fields.Date ?? ""
    const confirmTime = records[0].fields.Time ?? ""
    if (dancerUserId) {
      const [memberRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, dancerUserId)).limit(1)
      const utcConfirm = etToUtcIso(confirmDate, confirmTime, COMPANY_TZ)
      const confirmLabel = utcConfirm ? fmtTimeForNotif(utcConfirm, COMPANY_TZ, memberRow?.timezone ?? null) : `${fmtTime(confirmTime)} ET`
      createNotification({
        userId: dancerUserId,
        type: "booking_confirmed",
        title: "Booking confirmed",
        body: `${pm.name} has confirmed your session on ${fmtDate(confirmDate)} at ${confirmLabel}.`,
        bookingId,
        pushData: { route: "/member/bookings" },
      }).catch(() => {})
    }

    revalidatePath("/portal")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to confirm." }
  }
}

export async function adjustBooking(
  bookingId: string,
  fields: { date?: string; time?: string; notes?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await assertPrepMaster()
    const pm = await getPrepMasterByEmail(user.email)
    if (!pm) return { ok: false, error: "Staff record not found." }

    const records = await appBase.list<BookingFields>(TABLES.bookings, {
      filterByFormula: `AND({Prep Master Name} = '${pm.name.replace(/'/g, "\\'")}', RECORD_ID() = '${bookingId}')`,
      maxRecords: 1,
    })
    if (!records[0]) return { ok: false, error: "Booking not found." }

    const update: Partial<BookingFields> = {}
    if (fields.date) update.Date = fields.date
    if (fields.time) update.Time = fields.time
    if (fields.notes !== undefined) update.Notes = fields.notes

    await appBase.update<BookingFields>(TABLES.bookings, bookingId, update)

    const newDate = fields.date ?? records[0].fields.Date ?? ""
    const newTime = fields.time ?? records[0].fields.Time ?? ""
    const newNotes = fields.notes !== undefined ? fields.notes : (records[0].fields.Notes || undefined)
    const dancerEmail = records[0].fields["Client Email"]
    const dancerUserId = records[0].fields["User ID"]

    // Look up the dancer's proper name from their Member record
    let dancerName: string = dancerEmail ?? "Your member"
    if (dancerUserId) {
      const safeId = dancerUserId.replace(/'/g, "\\'")
      const memberRecords = await appBase.list<ClientFields>(TABLES.clients, {
        filterByFormula: `{User ID} = '${safeId}'`,
        maxRecords: 1,
      })
      if (memberRecords[0]?.fields.Name) dancerName = memberRecords[0].fields.Name
    }

    // In-app notification → member
    const utcAdjust = etToUtcIso(newDate, newTime, COMPANY_TZ)
    if (dancerUserId) {
      const [memberRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, dancerUserId)).limit(1)
      const memberAdjustLabel = utcAdjust ? fmtTimeForNotif(utcAdjust, COMPANY_TZ, memberRow?.timezone ?? null) : `${fmtTime(newTime)} ET`
      createNotification({
        userId: dancerUserId,
        type: "booking_updated",
        title: "Session rescheduled",
        body: `${pm.name} has rescheduled your session to ${fmtDate(newDate)} at ${memberAdjustLabel}.`,
        bookingId,
        pushData: { route: "/member/bookings" },
      }).catch(() => {})
    }

    // In-app notification → PrepMaster (themselves, as a confirmation)
    const [pmRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, user.id)).limit(1)
    const pmAdjustLabel = utcAdjust ? fmtTimeForNotif(utcAdjust, COMPANY_TZ, pmRow?.timezone ?? null) : `${fmtTime(newTime)} ET`
    createNotification({
      userId: user.id,
      type: "booking_updated",
      title: "Session updated",
      body: `You rescheduled the session to ${fmtDate(newDate)} at ${pmAdjustLabel}.`,
      bookingId,
      pushData: { route: "/portal" },
    }).catch(() => {})

    // Email both parties — fire and forget
    if (dancerEmail) {
      const { subject, html } = bookingUpdatedEmail({
        recipientName: dancerName,
        updatedByName: pm.name,
        updatedByRole: "PrepMaster",
        date: newDate,
        time: newTime,
        notes: newNotes,
      })
      sendEmail({ to: dancerEmail, subject, html }).catch((e) => console.error("Update email to dancer failed:", e))
    }
    const { subject, html } = bookingUpdatedEmail({
      recipientName: pm.name,
      updatedByName: pm.name,
      updatedByRole: "PrepMaster",
      date: newDate,
      time: newTime,
      notes: newNotes,
    })
    sendEmail({ to: user.email, subject, html }).catch((e) => console.error("Update email to PM failed:", e))

    // No revalidatePath here — the component updates optimistically in place,
    // so triggering a server re-render would cause the card to jump positions
    // in the sorted list, making it appear as a new card.
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to adjust." }
  }
}

export async function declineBooking(
  bookingId: string,
  reason: string,
  rescheduleAction?: "revert" | "cancel",
): Promise<{ ok: true; rescheduleReverted?: boolean } | { ok: false; error: string }> {
  try {
    const user = await assertPrepMaster()
    const pm = await getPrepMasterByEmail(user.email)
    if (!pm) return { ok: false, error: "Staff record not found." }

    const records = await appBase.list<BookingFields>(TABLES.bookings, {
      filterByFormula: `AND({Prep Master Name} = '${pm.name.replace(/'/g, "\\'")}', RECORD_ID() = '${bookingId}')`,
      maxRecords: 1,
    })
    if (!records[0]) return { ok: false, error: "Booking not found." }

    const booking = records[0]
    const isReschedule = !!(booking.fields["Is Reschedule"])
    const dancerUserId = booking.fields["User ID"]

    if (rescheduleAction === "revert") {
      // PM explicitly chose to keep the original booking (reschedule denied)
      const origDate = booking.fields["Original Date"] || booking.fields.Date || ""
      const origTime = booking.fields["Original Time"] || booking.fields.Time || ""
      const origUtc = booking.fields["Original UTC Datetime"] || booking.fields["UTC Datetime"] || ""
      await appBase.update<BookingFields>(TABLES.bookings, bookingId, {
        Status: "Confirmed",
        "Is Reschedule": false,
        Date: origDate,
        Time: origTime,
        ...(origUtc ? { "UTC Datetime": origUtc } : {}),
        "Original Date": "",
        "Original Time": "",
        "Original UTC Datetime": "",
        "Decline Reason": reason,
      })
      if (dancerUserId) {
        const [memberRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, dancerUserId)).limit(1)
        const utcForNotif = origUtc || etToUtcIso(origDate, origTime, COMPANY_TZ)
        const timeLabel = utcForNotif ? fmtTimeForNotif(utcForNotif, COMPANY_TZ, memberRow?.timezone ?? null) : `${fmtTime(origTime)} ET`
        createNotification({
          userId: dancerUserId,
          type: "booking_updated",
          title: "Reschedule request denied",
          body: `${pm.name} couldn't accommodate the reschedule. Your session remains on ${fmtDate(origDate)} at ${timeLabel}.`,
          bookingId,
          pushData: { route: "/member/bookings" },
        }).catch(() => {})
      }
      revalidatePath("/portal")
      return { ok: true, rescheduleReverted: true }
    }

    // Full booking decline (no prior reschedule) — refund credit
    await appBase.update<BookingFields>(TABLES.bookings, bookingId, {
      Status: "Declined",
      "Is Reschedule": false,
      "Decline Reason": reason,
    })

    const SESSION_CREDIT_COST: Record<string, number> = { "pack-hour": 1, "private-60": 1, "private-45": 0.75, "private-30": 0.5, "private-90": 1.5 }
    if (dancerUserId) {
      const safeId = dancerUserId.replace(/'/g, "\\'")
      const clientRecords = await appBase.list<ClientFields>(TABLES.clients, {
        filterByFormula: `{User ID} = '${safeId}'`,
        maxRecords: 1,
        revalidate: 0,
      })
      const client = clientRecords[0]
      if (client) {
        const sessionType = booking.fields["Session Type"] ?? "private-60"
        const creditRefund = SESSION_CREDIT_COST[sessionType] ?? 1
        const current = client.fields["Credits Remaining"] ?? 0
        await appBase.update<ClientFields>(TABLES.clients, client.id, {
          "Credits Remaining": Math.round((current + creditRefund) * 100) / 100,
        })
      }
      revalidatePath(`/dashboard`)
    }

    // Notify member in-app
    const declineDate = booking.fields.Date ?? ""
    const declineTime = booking.fields.Time ?? ""
    const dateLabel = fmtDate(declineDate)
    if (dancerUserId) {
      const [memberRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, dancerUserId)).limit(1)
      const utcDecline = etToUtcIso(declineDate, declineTime, COMPANY_TZ)
      const timeLabel = utcDecline ? fmtTimeForNotif(utcDecline, COMPANY_TZ, memberRow?.timezone ?? null) : `${fmtTime(declineTime)} ET`
      createNotification({
        userId: dancerUserId,
        type: "booking_cancelled",
        title: "Booking declined",
        body: `${pm.name} has declined your session on ${dateLabel} at ${timeLabel}. Your credit has been refunded.`,
        bookingId,
        pushData: { route: "/member/bookings" },
      }).catch(() => {})
    }

    revalidatePath("/portal")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to decline." }
  }
}

export async function cancelBookingAsPrepMaster(
  bookingId: string,
  reason: string,
): Promise<{ ok: true; creditRefunded: boolean } | { ok: false; error: string }> {
  try {
    const user = await assertPrepMaster()
    const pm = await getPrepMasterByEmail(user.email)
    if (!pm) return { ok: false, error: "Staff record not found." }

    const records = await appBase.list<BookingFields>(TABLES.bookings, {
      filterByFormula: `AND({Prep Master Name} = '${pm.name.replace(/'/g, "\\'")}', RECORD_ID() = '${bookingId}')`,
      maxRecords: 1,
    })
    if (!records[0]) return { ok: false, error: "Booking not found." }

    const booking = records[0].fields
    const dateStr = booking.Date ?? ""
    const timeStr = booking.Time ?? ""
    const dancerUserId = booking["User ID"]
    const dancerEmail = booking["Client Email"]

    await appBase.update<BookingFields>(TABLES.bookings, bookingId, {
      Status: "Cancelled",
      "Cancellation Reason": reason,
    })

    const dateLabel = fmtDate(dateStr)
    const utcCancel = etToUtcIso(dateStr, timeStr, COMPANY_TZ)

    // PM cancellation always refunds the member's credit
    if (dancerUserId) {
      const safeId = dancerUserId.replace(/'/g, "\\'")
      const clientRecords = await appBase.list<ClientFields>(TABLES.clients, {
        filterByFormula: `{User ID} = '${safeId}'`,
        maxRecords: 1,
        revalidate: 0,
      })
      const client = clientRecords[0]
      if (client) {
        const SESSION_CREDIT_COST: Record<string, number> = { "pack-hour": 1, "private-60": 1, "private-45": 0.75, "private-30": 0.5, "private-90": 1.5 }
        const sessionType = (booking["Session Type"] as string) ?? "private-60"
        const creditRefund = SESSION_CREDIT_COST[sessionType] ?? 1
        const current = client.fields["Credits Remaining"] ?? 0
        await appBase.update<ClientFields>(TABLES.clients, client.id, {
          "Credits Remaining": Math.round((current + creditRefund) * 100) / 100,
        })
      }
      revalidateTag(`member-${dancerUserId}`)
    }

    // Notify member
    if (dancerUserId) {
      const [memberRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, dancerUserId)).limit(1)
      const memberCancelLabel = utcCancel ? fmtTimeForNotif(utcCancel, COMPANY_TZ, memberRow?.timezone ?? null) : `${fmtTime(timeStr)} ET`
      createNotification({
        userId: dancerUserId,
        type: "booking_cancelled",
        title: "Session cancelled by PrepMaster",
        body: `${pm.name} cancelled your session on ${dateLabel} at ${memberCancelLabel}. Your credit has been refunded.`,
        bookingId,
        pushData: { route: "/member/bookings" },
      }).catch(() => {})
    }

    // Notify PM (confirmation)
    const [pmRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, user.id)).limit(1)
    const pmCancelLabel = utcCancel ? fmtTimeForNotif(utcCancel, COMPANY_TZ, pmRow?.timezone ?? null) : `${fmtTime(timeStr)} ET`
    createNotification({
      userId: user.id,
      type: "booking_cancelled",
      title: "Session cancelled",
      body: `You cancelled the session on ${dateLabel} at ${pmCancelLabel}. The member's credit has been refunded.`,
      bookingId,
      pushData: { route: "/portal" },
    }).catch(() => {})

    // Email member
    if (dancerEmail) {
      let dancerName = dancerEmail
      if (dancerUserId) {
        const memberRecords = await appBase.list<ClientFields>(TABLES.clients, {
          filterByFormula: `{User ID} = '${dancerUserId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        })
        if (memberRecords[0]?.fields.Name) dancerName = memberRecords[0].fields.Name
      }
      const { subject, html } = bookingCancelledEmail({
        dancerName,
        prepMasterName: pm.name,
        date: dateStr,
        time: timeStr,
        creditRefunded: true,
      })
      sendEmail({ to: dancerEmail, subject, html }).catch(() => {})
    }

    revalidatePath("/portal")
    return { ok: true, creditRefunded: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to cancel." }
  }
}
