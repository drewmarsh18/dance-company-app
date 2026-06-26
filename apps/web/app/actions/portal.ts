"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { getSessionUserWithRole } from "@/lib/roles"
import { TABLES, appBase, getPrepMasterByEmail, type BookingFields } from "@/lib/airtable"

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
