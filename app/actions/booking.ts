"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import {
  TABLES,
  appBase,
  getPrepMaster,
  getPrepMasterPhone,
  getBookedSlots,
  getActivePlanForUser,
  getMostRecentInactivePlanForUser,
  setPlanStatus,
  type BookingFields,
  type ClientFields,
} from "@/lib/airtable"
import { sendSms } from "@/lib/sms"
import { getAvailabilityForEmail } from "@/app/actions/availability"
import { slotsForDate } from "@/lib/availability"
import { isWithin24Hours } from "@/lib/utils"

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
}

export async function getMyBookings(): Promise<Booking[]> {
  const user = await getSessionUser()
  // Escape quotes in the user id for the Airtable formula.
  const safeId = user.id.replace(/'/g, "\\'")
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
  }))
}

// Finds the dancer's Member record (or null) by their auth user id.
async function findClientRecord(userId: string) {
  const safeId = userId.replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `{User ID} = '${safeId}'`,
    maxRecords: 1,
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
      Status: "Cancelled",
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
    })

    const newCredits = credits - 1
    await appBase.update<ClientFields>(TABLES.clients, client.id, {
      "Credits Remaining": newCredits,
    })

    // If this booking used the last credit, mark the active plan as Inactive
    if (newCredits === 0) {
      const activePlan = await getActivePlanForUser(user.id)
      if (activePlan) await setPlanStatus(activePlan.id, "Inactive")
    }

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
