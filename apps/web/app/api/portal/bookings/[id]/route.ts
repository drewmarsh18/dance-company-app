import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { getPrepMasterByEmail, TABLES, appBase, type BookingFields, type ClientFields } from "@/lib/airtable"
import { createNotification } from "@/app/actions/notifications"
import { sendEmail, bookingUpdatedEmail, bookingCancelledEmail } from "@/lib/email"
import { isWithin24Hours, fmtDate, fmtTime, etToUtcIso, fmtTimeForNotif, COMPANY_TZ } from "@/lib/utils"
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

  const body = await req.json() as { date?: string; time?: string; prepMasterNotes?: string; action?: "confirm" | "decline" | "cancel"; declineReason?: string; cancellationReason?: string; rescheduleAction?: "revert" | "cancel" }

  if (body.action === "confirm") {
    await appBase.update<BookingFields>(TABLES.bookings, id, {
      Status: "Confirmed",
      "Is Reschedule": false,
      "Original Date": "",
      "Original Time": "",
      "Original UTC Datetime": "",
    })
    revalidateTag(`portal-${session.user.email}`, "max")
    const dancerUserId = booking.fields["User ID"]
    if (dancerUserId) {
      revalidateTag(`member-${dancerUserId}`, "max")
      const [pmRow, dancerRow] = await Promise.all([
        db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.email, session.user.email)).limit(1),
        db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, dancerUserId)).limit(1),
      ])
      const pmTz = pmRow[0]?.timezone ?? COMPANY_TZ
      const dTz = dancerRow[0]?.timezone ?? null
      const utcStr = booking.fields["UTC Datetime"] ?? etToUtcIso(booking.fields.Date ?? "", booking.fields.Time ?? "", pmTz)
      const timeLabel = utcStr ? fmtTimeForNotif(utcStr, pmTz, dTz) : `${fmtTime(booking.fields.Time ?? "")} ET`
      createNotification({
        userId: dancerUserId,
        type: "booking_confirmed",
        title: "Booking confirmed",
        body: `${pm.name} has confirmed your session on ${fmtDate(booking.fields.Date ?? "")} at ${timeLabel}.`,
        bookingId: id,
        pushData: { route: "/member/bookings" },
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  if (body.action === "decline") {
    const dancerUserId = booking.fields["User ID"]
    const isReschedule = !!(booking.fields["Is Reschedule"])

    if (body.rescheduleAction === "revert") {
      // PM explicitly chose to keep the original booking (reschedule denied)
      const origDate = booking.fields["Original Date"] ?? booking.fields.Date ?? ""
      const origTime = booking.fields["Original Time"] ?? booking.fields.Time ?? ""
      const origUtc = booking.fields["Original UTC Datetime"] ?? booking.fields["UTC Datetime"] ?? ""
      await appBase.update<BookingFields>(TABLES.bookings, id, {
        Status: "Confirmed",
        "Is Reschedule": false,
        Date: origDate,
        Time: origTime,
        ...(origUtc ? { "UTC Datetime": origUtc } : {}),
        "Original Date": "",
        "Original Time": "",
        "Original UTC Datetime": "",
        ...(body.declineReason ? { "Decline Reason": body.declineReason } : {}),
      })
      revalidateTag(`portal-${session.user.email}`)
      if (dancerUserId) {
        revalidateTag(`member-${dancerUserId}`)
        const [dTzRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, dancerUserId)).limit(1)
        const [pmTzRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.email, session.user.email)).limit(1)
        const pmTz = pmTzRow[0]?.timezone ?? COMPANY_TZ
        const utcForNotif = origUtc || etToUtcIso(origDate, origTime, pmTz)
        const timeLabel = utcForNotif ? fmtTimeForNotif(utcForNotif, pmTz, dTzRow[0]?.timezone ?? null) : `${fmtTime(origTime)} ET`
        createNotification({
          userId: dancerUserId,
          type: "booking_updated",
          title: "Reschedule request denied",
          body: `${pm.name} couldn't accommodate the reschedule. Your session remains on ${fmtDate(origDate)} at ${timeLabel}.`,
          bookingId: id,
          pushData: { route: "/member/bookings" },
        }).catch(() => {})
      }
      return NextResponse.json({ ok: true, rescheduleReverted: true, origDate, origTime, origUtc: origUtc || null })
    }

    // Full booking decline (no prior reschedule) — refund credit
    await appBase.update<BookingFields>(TABLES.bookings, id, {
      Status: "Declined",
      "Is Reschedule": false,
      ...(body.declineReason ? { "Decline Reason": body.declineReason } : {}),
    })
    revalidateTag(`portal-${session.user.email}`)

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
        const sessionType = booking.fields["Session Type"] ?? "private-60"
        const creditRefund = SESSION_CREDIT_COST[sessionType] ?? 1
        const current = client.fields["Credits Remaining"] ?? 0
        await appBase.update<ClientFields>(TABLES.clients, client.id, {
          "Credits Remaining": Math.round((current + creditRefund) * 100) / 100,
        })
      }
      revalidateTag(`member-${dancerUserId}`)
      const [pmDRow, dTzRow] = await Promise.all([
        db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.email, session.user.email)).limit(1),
        db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, dancerUserId)).limit(1),
      ])
      const pmTzDecline = pmDRow[0]?.timezone ?? COMPANY_TZ
      const dTzDecline = dTzRow[0]?.timezone ?? null
      const utcDecline = booking.fields["UTC Datetime"] ?? etToUtcIso(booking.fields.Date ?? "", booking.fields.Time ?? "", pmTzDecline)
      const timeLabelDecline = utcDecline ? fmtTimeForNotif(utcDecline, pmTzDecline, dTzDecline) : `${fmtTime(booking.fields.Time ?? "")} ET`
      createNotification({
        userId: dancerUserId,
        type: "booking_cancelled",
        title: "Booking declined",
        body: `${pm.name} has declined your session on ${fmtDate(booking.fields.Date ?? "")} at ${timeLabelDecline}. Your credit has been refunded.`,
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

    await appBase.update<BookingFields>(TABLES.bookings, id, {
      Status: "Cancelled",
      ...(body.cancellationReason ? { "Cancellation Reason": body.cancellationReason } : {}),
    })

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
        const sessionType = booking.fields["Session Type"] ?? "private-60"
        const creditRefund = SESSION_CREDIT_COST[sessionType] ?? 1
        const current = client.fields["Credits Remaining"] ?? 0
        await appBase.update<ClientFields>(TABLES.clients, client.id, {
          "Credits Remaining": Math.round((current + creditRefund) * 100) / 100,
        })
      }
    }

    if (dancerUserId) {
      revalidateTag(`member-${dancerUserId}`, "max")
      createNotification({
        userId: dancerUserId,
        type: "booking_cancelled",
        title: "Session cancelled by PrepMaster",
        body: `${pm.name} cancelled your session on ${fmtDate(dateStr)} at ${fmtTime(timeStr)}. Your credit has been refunded.`,
        bookingId: id,
        pushData: { route: "/member/bookings" },
      }).catch(() => {})
    }

    if (dancerEmail) {
      let dancerName = dancerEmail
      let parentCC: string | null = null
      if (dancerUserId) {
        const safeId = dancerUserId.replace(/'/g, "\\'")
        const memberRecords = await appBase.list<ClientFields>(TABLES.clients, {
          filterByFormula: `{User ID} = '${safeId}'`,
          maxRecords: 1,
        })
        const memberRecord = memberRecords[0]
        if (memberRecord?.fields.Name) dancerName = memberRecord.fields.Name
        parentCC = memberRecord?.fields?.["Parent Email"] ?? null
      }
      const { subject, html } = bookingCancelledEmail({
        dancerName,
        prepMasterName: pm.name,
        date: dateStr,
        time: timeStr,
        creditRefunded: true,
      })
      sendEmail({ to: dancerEmail, cc: parentCC ?? undefined, subject, html }).catch(() => {})
    }

    revalidateTag(`portal-${session.user.email}`, "max")
    return NextResponse.json({ ok: true, creditRefunded: true })
  }

  // Edit date/time/PrepMaster notes
  const update: Partial<BookingFields> = {}
  if (body.date) update.Date = body.date
  if (body.time) update.Time = body.time
  if (body.prepMasterNotes !== undefined) update["Prep Master Notes"] = body.prepMasterNotes
  if (body.date || body.time) {
    const [pmTzRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.email, session.user.email)).limit(1)
    const pmTz = pmTzRow?.timezone ?? COMPANY_TZ
    const utc = etToUtcIso(
      body.date ?? booking.fields.Date ?? "",
      body.time ?? booking.fields.Time ?? "",
      pmTz,
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
  let dancerTz: string | null = null
  let rescheduleParentCC: string | null = null
  if (dancerUserId) {
    const safeId = dancerUserId.replace(/'/g, "\\'")
    const [memberRecord, dbRow] = await Promise.all([
      appBase.list<ClientFields>(TABLES.clients, { filterByFormula: `{User ID} = '${safeId}'`, maxRecords: 1 }),
      db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.id, dancerUserId)).limit(1),
    ])
    if (memberRecord[0]?.fields.Name) dancerName = memberRecord[0].fields.Name
    rescheduleParentCC = memberRecord[0]?.fields?.["Parent Email"] ?? null
    dancerTz = dbRow[0]?.timezone ?? null
  }
  const [pmDbRow] = await db.select({ timezone: userTable.timezone }).from(userTable).where(eq(userTable.email, session.user.email)).limit(1)
  const pmTz = pmDbRow?.timezone ?? COMPANY_TZ

  if (dancerUserId) {
    const utcForNotif = update["UTC Datetime"] ?? booking.fields["UTC Datetime"] ?? etToUtcIso(newDate, newTime, pmTz)
    const timeLabel = utcForNotif
      ? fmtTimeForNotif(utcForNotif, pmTz, dancerTz)
      : `${fmtTime(newTime)} ET`
    createNotification({
      userId: dancerUserId,
      type: "booking_updated",
      title: "Session rescheduled",
      body: `${pm.name} has rescheduled your session to ${fmtDate(newDate)} at ${timeLabel}.`,
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
    sendEmail({ to: dancerEmail, cc: rescheduleParentCC ?? undefined, subject, html }).catch(() => {})
  }

  // Return the computed UTC so the mobile app can update localUtcDatetime immediately
  return NextResponse.json({ ok: true, utcDatetime: update["UTC Datetime"] ?? null })
}
