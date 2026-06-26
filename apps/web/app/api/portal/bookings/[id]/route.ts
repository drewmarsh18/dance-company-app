import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getPrepMasterByEmail, TABLES, appBase, type BookingFields, type ClientFields } from "@/lib/airtable"
import { createNotification } from "@/app/actions/notifications"
import { sendEmail, bookingUpdatedEmail } from "@/lib/email"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

async function getPmAndBooking(sessionEmail: string, bookingId: string) {
  const pm = await getPrepMasterByEmail(sessionEmail)
  if (!pm) return { pm: null, booking: null }
  const safe = pm.name.replace(/'/g, "\\'")
  const records = await appBase.list<BookingFields>(TABLES.bookings, {
    filterByFormula: `AND({Prep Master Name} = '${safe}', RECORD_ID() = '${bookingId}')`,
    maxRecords: 1,
  })
  return { pm, booking: records[0] ?? null }
}

// PATCH — adjust date/time/notes
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { pm, booking } = await getPmAndBooking(session.user.email, id)
  if (!pm || !booking) return NextResponse.json({ ok: false, error: "Booking not found." })

  const body = await req.json() as { date?: string; time?: string; notes?: string; action?: "confirm" | "decline" }

  if (body.action === "confirm") {
    await appBase.update<BookingFields>(TABLES.bookings, id, { Status: "Confirmed" })
    const dancerUserId = booking.fields["User ID"]
    if (dancerUserId) {
      createNotification({
        userId: dancerUserId,
        type: "booking_confirmed",
        title: "Booking confirmed",
        body: `${pm.name} has confirmed your session on ${booking.fields.Date ?? ""} at ${booking.fields.Time ?? ""}.`,
        bookingId: id,
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  if (body.action === "decline") {
    await appBase.update<BookingFields>(TABLES.bookings, id, { Status: "Cancelled" })
    const dancerUserId = booking.fields["User ID"]
    if (dancerUserId) {
      createNotification({
        userId: dancerUserId,
        type: "booking_cancelled",
        title: "Booking declined",
        body: `${pm.name} has declined your session request on ${booking.fields.Date ?? ""} at ${booking.fields.Time ?? ""}. Your credit has been refunded.`,
        bookingId: id,
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  // Edit date/time/notes
  const update: Partial<BookingFields> = {}
  if (body.date) update.Date = body.date
  if (body.time) update.Time = body.time
  if (body.notes !== undefined) update.Notes = body.notes
  await appBase.update<BookingFields>(TABLES.bookings, id, update)

  const newDate = body.date ?? booking.fields.Date ?? ""
  const newTime = body.time ?? booking.fields.Time ?? ""
  const newNotes = body.notes !== undefined ? body.notes : (booking.fields.Notes || undefined)
  const dancerEmail = booking.fields["Client Email"]
  const dancerUserId = booking.fields["User ID"]

  let dancerName = dancerEmail ?? "Your member"
  if (dancerUserId) {
    const safeId = dancerUserId.replace(/'/g, "\\'")
    const memberRecords = await appBase.list<ClientFields>(TABLES.clients, {
      filterByFormula: `{User ID} = '${safeId}'`,
      maxRecords: 1,
    })
    if (memberRecords[0]?.fields.Name) dancerName = memberRecords[0].fields.Name
  }

  if (dancerUserId) {
    createNotification({
      userId: dancerUserId,
      type: "booking_updated",
      title: "Session rescheduled",
      body: `${pm.name} has rescheduled your session to ${newDate} at ${newTime}.`,
      bookingId: id,
    }).catch(() => {})
  }

  if (dancerEmail) {
    const { subject, html } = bookingUpdatedEmail({
      recipientName: dancerName,
      updatedByName: pm.name,
      updatedByRole: "prep master",
      date: newDate,
      time: newTime,
      notes: newNotes,
    })
    sendEmail({ to: dancerEmail, subject, html }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
