"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { getSessionUserWithRole } from "@/lib/roles"
import { TABLES, appBase, getPrepMasterByEmail, type BookingFields } from "@/lib/airtable"
import { sendEmail, bookingUpdatedEmail } from "@/lib/email"

async function assertPrepMaster() {
  const user = await getSessionUserWithRole()
  if (!user || (user.role !== "prep_master" && user.role !== "admin")) throw new Error("Unauthorized")
  return user
}

export async function confirmBooking(
  bookingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await assertPrepMaster()
    const pm = await getPrepMasterByEmail(user.email)
    if (!pm) return { ok: false, error: "Staff record not found." }

    // Verify this booking belongs to this prep master
    const records = await appBase.list<BookingFields>(TABLES.bookings, {
      filterByFormula: `AND({Prep Master Name} = '${pm.name.replace(/'/g, "\\'")}', RECORD_ID() = '${bookingId}')`,
      maxRecords: 1,
    })
    if (!records[0]) return { ok: false, error: "Booking not found." }

    await appBase.update<BookingFields>(TABLES.bookings, bookingId, {
      Status: "Confirmed",
    })
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

    // Notify both parties of the change — fire and forget
    const newDate = fields.date ?? records[0].fields.Date ?? ""
    const newTime = fields.time ?? records[0].fields.Time ?? ""
    const dancerEmail = records[0].fields["Client Email"]
    if (dancerEmail) {
      const { subject, html } = bookingUpdatedEmail({
        recipientName: dancerEmail,
        updatedByName: pm.name,
        updatedByRole: "prep master",
        date: newDate,
        time: newTime,
      })
      sendEmail({ to: dancerEmail, subject, html }).catch((e) => console.error("Update email to dancer failed:", e))
    }
    const { subject, html } = bookingUpdatedEmail({
      recipientName: pm.name,
      updatedByName: pm.name,
      updatedByRole: "prep master",
      date: newDate,
      time: newTime,
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

    await appBase.update<BookingFields>(TABLES.bookings, bookingId, {
      Status: "Cancelled",
    })
    revalidatePath("/portal")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to decline." }
  }
}
