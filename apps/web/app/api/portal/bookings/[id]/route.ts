import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { getPrepMasterByEmail, TABLES, appBase, type BookingFields, type ClientFields } from "@/lib/airtable"
import { createNotification } from "@/app/actions/notifications"
import { sendEmail, bookingUpdatedEmail, bookingCancelledEmail } from "@/lib/email"
import { isWithin24Hours, fmtDate, fmtTime, etToUtcIso } from "@/lib/utils"
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

  const body = await req.json() as { date?: string; time?: string; prepMasterNotes?: string; action?: "confirm" | "decline" | "cancel"; declineReason?: string; cancellationReason?: string }

  if (body.action === "confirm") {
    await appBase.update<BookingFields>(TABLES.bookings, id, { Status: "Confirmed" })
    revalidateTag(`portal-${session.user.email}`, "max")
    const dancerUserId = booking.fields["User ID"]
    if (dancerUserId) {
      revalidateTag(`member-${dancerUserId}`, "max")
      createNotification({
        userId: dancerUserId,
        type: "booking_confirmed",
        title: "Booking confirmed",
        body: `${pm.name} has confirmed your session on ${fmtDate(booking.fields.Date ?? "")} at ${fmtTime(booking.fields.Time ?? "")} ET.`,
        bookingId: id,
        pushData: { route: "/member/bookings" },
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  if (body.action === "decline") {
    await appBase.update<BookingFields>(TABLES.bookings, id, {
      Status: "Declined",
      ...(body.declineReason ? { "Decline Reason": body.declineReason } : {}),
    })
    revalidateTag(`portal-${session.user.email}`, "max")

    const dancerUserId = booking.fields["User ID"]

    // Always refund credit when PrepMaster declines — member shouldn't be penalized
    if (dancerUserId) {
      const safeId = dancerUserId.replace(/'/g, "\\'")
      const clientRecords = await appBase.list<ClientFields>(TABLES.clients, {
        filterByFormula: `{User ID} = '${safeId}'`,
        maxRecords: 1,
      })
      const client = clientRecords[0]
      if (client) {
        const current = client.fields["Credits Remaining"] ?? 0
        await appBase.update<ClientFields>(TABLES.clients, client.id, {
          "Credits Remaining": current + 1,
        })
      }
      revalidateTag(`member-${dancerUserId}`, "max")
      createNotification({
        userId: dancerUserId,
        type: "booking_cancelled",
        title: "Booking declined",
        body: `${pm.name} has declined your session on ${fmtDate(booking.fields.Date ?? "")} at ${fmtTime(booking.fields.Time ?? "")} ET. Your credit has been refunded.`,
        bookingId: id,
        pushData: { route: "/member/bookings" },
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true, creditRefunded: true })
  }

  if (body.action === "cancel") {
    const dateStr = booking.fields.Date ?? ""
    const timeStr = booking.fields.Time ?? ""
    const dancerUserId = booking.fields["User ID"]
    const dancerEmail = booking.fields["Client Email"]

    // Credit refunded if PM cancels within 24h of session
    const within24 = isWithin24Hours(dateStr, timeStr)

    await appBase.update<BookingFields>(TABLES.bookings, id, {
      Status: "Cancelled",
      ...(body.cancellationReason ? { "Cancellation Reason": body.cancellationReason } : {}),
    })

    if (dancerUserId && within24) {
      const safeId = dancerUserId.replace(/'/g, "\\'")
      const clientRecords = await appBase.list<ClientFields>(TABLES.clients, {
        filterByFormula: `{User ID} = '${safeId}'`,
        maxRecords: 1,
      })
      const client = clientRecords[0]
      if (client) {
        const current = client.fields["Credits Remaining"] ?? 0
        await appBase.update<ClientFields>(TABLES.clients, client.id, { "Credits Remaining": current + 1 })
      }
    }

    if (dancerUserId) {
      revalidateTag(`member-${dancerUserId}`, "max")
      const notifBody = within24
        ? `${pm.name} cancelled your session on ${fmtDate(dateStr)} at ${fmtTime(timeStr)}. Your credit has been refunded.`
        : `${pm.name} cancelled your session on ${fmtDate(dateStr)} at ${fmtTime(timeStr)} ET.`
      createNotification({
        userId: dancerUserId,
        type: "booking_cancelled",
        title: "Session cancelled by PrepMaster",
        body: notifBody,
        bookingId: id,
        pushData: { route: "/member/bookings" },
      }).catch(() => {})
    }

    if (dancerEmail) {
      let dancerName = dancerEmail
      if (dancerUserId) {
        const safeId = dancerUserId.replace(/'/g, "\\'")
        const memberRecords = await appBase.list<ClientFields>(TABLES.clients, {
          filterByFormula: `{User ID} = '${safeId}'`,
          maxRecords: 1,
        })
        if (memberRecords[0]?.fields.Name) dancerName = memberRecords[0].fields.Name
      }
      const { subject, html } = bookingCancelledEmail({
        dancerName,
        prepMasterName: pm.name,
        date: dateStr,
        time: timeStr,
        creditRefunded: within24,
      })
      sendEmail({ to: dancerEmail, subject, html }).catch(() => {})
    }

    revalidateTag(`portal-${session.user.email}`, "max")
    return NextResponse.json({ ok: true, creditRefunded: within24 })
  }

  // Edit date/time/PrepMaster notes
  const update: Partial<BookingFields> = {}
  if (body.date) update.Date = body.date
  if (body.time) update.Time = body.time
  if (body.prepMasterNotes !== undefined) update["Prep Master Notes"] = body.prepMasterNotes
  if (body.date || body.time) {
    const utc = etToUtcIso(
      body.date ?? booking.fields.Date ?? "",
      body.time ?? booking.fields.Time ?? "",
    )
    if (utc) update["UTC Datetime"] = utc
  }
  await appBase.update<BookingFields>(TABLES.bookings, id, update)
  revalidateTag(`portal-${session.user.email}`, "max")
  if (booking.fields["User ID"]) revalidateTag(`member-${booking.fields["User ID"]}`, "max")

  const newDate = body.date ?? booking.fields.Date ?? ""
  const newTime = body.time ?? booking.fields.Time ?? ""
  const newNotes = body.prepMasterNotes !== undefined ? body.prepMasterNotes : (booking.fields["Prep Master Notes"] || undefined)
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
      body: `${pm.name} has rescheduled your session to ${fmtDate(newDate)} at ${fmtTime(newTime)} ET.`,
      bookingId: id,
      pushData: { route: "/member/bookings" },
    }).catch(() => {})
  }

  if (dancerEmail) {
    const { subject, html } = bookingUpdatedEmail({
      recipientName: dancerName,
      updatedByName: pm.name,
      updatedByRole: "PrepMaster",
      date: newDate,
      time: newTime,
      notes: newNotes,
    })
    sendEmail({ to: dancerEmail, subject, html }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
