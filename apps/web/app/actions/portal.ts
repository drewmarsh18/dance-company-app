"use server"

import { revalidatePath } from "next/cache"
import { getSessionUserWithRole } from "@/lib/roles"
import { TABLES, appBase, getPrepMasterByEmail, type BookingFields, type ClientFields } from "@/lib/airtable"
import { sendEmail, bookingUpdatedEmail } from "@/lib/email"
import { createNotification } from "@/app/actions/notifications"
import { fmtDate, fmtTime } from "@/lib/utils"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

async function assertPrepMaster() {
  const user = await getSessionUserWithRole()
  if (!user || (user.role !== "prep_master" && user.role !== "admin")) throw new Error("Unauthorized")
  return user
}

async function getUserIdByEmail(email: string): Promise<string | null> {
  const [row] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, email))
  return row?.id ?? null
}

export async function confirmBooking(
  bookingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await assertPrepMaster()
    const pm = await getPrepMasterByEmail(user.email)
    if (!pm) return { ok: false, error: "Staff record not found." }

    const records = await appBase.list<BookingFields>(TABLES.bookings, {
      filterByFormula: `AND({PrepMaster Name} = '${pm.name.replace(/'/g, "\\'")}', RECORD_ID() = '${bookingId}')`,
      maxRecords: 1,
    })
    if (!records[0]) return { ok: false, error: "Booking not found." }

    await appBase.update<BookingFields>(TABLES.bookings, bookingId, { Status: "Confirmed" })

    // Notify member in-app
    const dancerUserId = records[0].fields["User ID"]
    if (dancerUserId) {
      createNotification({
        userId: dancerUserId,
        type: "booking_confirmed",
        title: "Booking confirmed",
        body: `${pm.name} has confirmed your session on ${records[0].fields.Date ?? ""} at ${records[0].fields.Time ?? ""}.`,
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
      filterByFormula: `AND({PrepMaster Name} = '${pm.name.replace(/'/g, "\\'")}', RECORD_ID() = '${bookingId}')`,
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
    if (dancerUserId) {
      createNotification({
        userId: dancerUserId,
        type: "booking_updated",
        title: "Session rescheduled",
        body: `${pm.name} has rescheduled your session to ${newDate} at ${newTime}.`,
        bookingId,
        pushData: { route: "/member/bookings" },
      }).catch(() => {})
    }

    // In-app notification → PrepMaster (themselves, as a confirmation)
    createNotification({
      userId: user.id,
      type: "booking_updated",
      title: "Session updated",
      body: `You rescheduled the session on ${newDate} at ${newTime}.`,
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
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await assertPrepMaster()
    const pm = await getPrepMasterByEmail(user.email)
    if (!pm) return { ok: false, error: "Staff record not found." }

    const records = await appBase.list<BookingFields>(TABLES.bookings, {
      filterByFormula: `AND({PrepMaster Name} = '${pm.name.replace(/'/g, "\\'")}', RECORD_ID() = '${bookingId}')`,
      maxRecords: 1,
    })
    if (!records[0]) return { ok: false, error: "Booking not found." }

    await appBase.update<BookingFields>(TABLES.bookings, bookingId, {
      Status: "Cancelled",
      "Decline Reason": reason,
    })

    // Notify member in-app
    const dancerUserId = records[0].fields["User ID"]
    const dateLabel = fmtDate(records[0].fields.Date ?? "")
    const timeLabel = fmtTime(records[0].fields.Time ?? "")
    if (dancerUserId) {
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
