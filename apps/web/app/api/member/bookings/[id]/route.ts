import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { TABLES, appBase, type BookingFields, type ClientFields } from "@/lib/airtable"
import { createNotification } from "@/app/actions/notifications"
import { sendEmail, bookingCancelledEmail, bookingUpdatedEmail } from "@/lib/email"
import { isWithin24Hours } from "@/lib/utils"
import { getPrepMasters } from "@/lib/airtable"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return session.user
}

async function findClientRecord(userId: string) {
  const safeId = userId.replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `{User ID} = '${safeId}'`,
    maxRecords: 1,
    revalidate: 0,
  })
  return records[0] ?? null
}

// DELETE — cancel booking
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({})) as { reason?: string }

  const safeUserId = user.id.replace(/'/g, "\\'")
  const records = await appBase.list<BookingFields>(TABLES.bookings, {
    filterByFormula: `AND({User ID} = '${safeUserId}', RECORD_ID() = '${id}')`,
    maxRecords: 1,
  })
  const booking = records[0]
  if (!booking) return NextResponse.json({ ok: false, error: "Booking not found." })

  const within24 = isWithin24Hours(booking.fields.Date ?? "", booking.fields.Time ?? "")
  await appBase.update<BookingFields>(TABLES.bookings, id, {
    Status: within24 ? "Cancelled (Late)" : "Cancelled",
    ...(body.reason ? { "Cancellation Reason": body.reason } : {}),
  })

  if (!within24) {
    const client = await findClientRecord(user.id)
    if (client) {
      const current = client.fields["Credits Remaining"] ?? 0
      await appBase.update<ClientFields>(TABLES.clients, client.id, {
        "Credits Remaining": current + 1,
      })
    }
  }

  const pmName = booking.fields["Prep Master Name"] ?? "your Prep Master"
  const dateLabel = booking.fields.Date ?? "your session"

  createNotification({
    userId: user.id,
    type: "booking_cancelled",
    title: "Booking cancelled",
    body: `Your session with ${pmName} on ${dateLabel} has been cancelled.${within24 ? " No credit refunded (within 24 hours)." : ""}`,
    bookingId: id,
  }).catch(() => {})

  if (user.email) {
    const { subject, html } = bookingCancelledEmail({
      dancerName: user.name ?? "Dancer",
      prepMasterName: pmName,
      date: booking.fields.Date ?? dateLabel,
      time: booking.fields.Time ?? "",
      creditRefunded: !within24,
    })
    sendEmail({ to: user.email, subject, html }).catch(() => {})
  }

  return NextResponse.json({ ok: true, creditRefunded: !within24 })
}

// PATCH — reschedule booking
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const safeUserId = user.id.replace(/'/g, "\\'")
  const records = await appBase.list<BookingFields>(TABLES.bookings, {
    filterByFormula: `AND({User ID} = '${safeUserId}', RECORD_ID() = '${id}')`,
    maxRecords: 1,
  })
  const booking = records[0]
  if (!booking) return NextResponse.json({ ok: false, error: "Booking not found." })

  if (isWithin24Hours(booking.fields.Date ?? "", booking.fields.Time ?? "")) {
    return NextResponse.json({ ok: false, error: "Bookings within 24 hours cannot be rescheduled." })
  }

  const body = await req.json() as { date?: string; time?: string; notes?: string }
  const update: Partial<BookingFields> = { Status: "Pending" }
  if (body.date) update.Date = body.date
  if (body.time) update.Time = body.time
  if (body.notes !== undefined) update.Notes = body.notes
  await appBase.update<BookingFields>(TABLES.bookings, id, update)

  const newDate = body.date ?? booking.fields.Date ?? ""
  const newTime = body.time ?? booking.fields.Time ?? ""
  const pmName = booking.fields["Prep Master Name"] ?? ""
  const client = await findClientRecord(user.id)
  const memberName = client?.fields.Name ?? user.name ?? user.email ?? "Your member"

  createNotification({
    userId: user.id,
    type: "booking_updated",
    title: "Booking rescheduled",
    body: `Your session with ${pmName} has been moved to ${newDate} at ${newTime}.`,
    bookingId: id,
  }).catch(() => {})

  if (user.email) {
    const { subject, html } = bookingUpdatedEmail({
      recipientName: memberName,
      updatedByName: memberName,
      updatedByRole: "member",
      date: newDate,
      time: newTime,
      notes: body.notes,
    })
    sendEmail({ to: user.email, subject, html }).catch(() => {})
  }

  // Notify prep master
  getPrepMasters().then(async (all) => {
    const pm = all.find((p) => p.name === pmName)
    if (!pm?.email) return
    const [pmUser] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, pm.email))
    if (pmUser) {
      createNotification({
        userId: pmUser.id,
        type: "booking_updated",
        title: "Session rescheduled",
        body: `${memberName} has rescheduled their session to ${newDate} at ${newTime}.`,
        bookingId: id,
      }).catch(() => {})
    }
    const { subject, html } = bookingUpdatedEmail({
      recipientName: pm.name,
      updatedByName: memberName,
      updatedByRole: "member",
      date: newDate,
      time: newTime,
      notes: body.notes,
    })
    sendEmail({ to: pm.email, subject, html }).catch(() => {})
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
