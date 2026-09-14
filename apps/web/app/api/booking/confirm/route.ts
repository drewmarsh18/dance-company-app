import { NextRequest, NextResponse } from "next/server"
import { appBase, TABLES, type BookingFields, type ClientFields, type AirtableRecord, getMostRecentInactivePlanForUser, setPlanStatus, getPrepMasters } from "@/lib/airtable"
import { sendEmail, bookingCancelledEmail } from "@/lib/email"
import { db } from "@/lib/db"
import { user as userTable, calendarEventLink } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar"
import { COMPANY_TZ, verifyConfirmToken } from "@/lib/utils"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.collegedanceprep.com"
const SECRET = process.env.BOOKING_CONFIRM_SECRET
if (!SECRET) throw new Error("BOOKING_CONFIRM_SECRET env var is not set")

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get("id")
  const action = searchParams.get("action") // "approve" | "deny"
  const token = searchParams.get("token")

  if (!bookingId || !action || !token || !verifyConfirmToken(SECRET!, bookingId, action, token)) {
    return NextResponse.redirect(`${APP_URL}/dashboard`)
  }

  try {
    const records = await appBase.list<BookingFields>(TABLES.bookings, {
      filterByFormula: `RECORD_ID() = '${bookingId}'`,
      maxRecords: 1,
    })
    const booking = records[0]
    if (!booking) return NextResponse.redirect(`${APP_URL}/dashboard`)

    const currentStatus = booking.fields.Status ?? ""
    if (currentStatus !== "Pending") {
      // Already handled — show a simple message
      return new NextResponse(
        `<html><body style="font-family:sans-serif;padding:40px;max-width:480px;margin:0 auto">
          <h2>Already processed</h2>
          <p>This booking request has already been ${currentStatus.toLowerCase()}.</p>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      )
    }

    if (action === "approve") {
      await appBase.update<BookingFields>(TABLES.bookings, bookingId, { Status: "Confirmed" })

      // In-app notification for dancer
      const dancerUserId = booking.fields["User ID"]
      if (dancerUserId) {
        const { createNotification } = await import("@/app/actions/notifications")
        createNotification({
          userId: dancerUserId,
          type: "booking_confirmed",
          title: "Booking confirmed",
          body: `${booking.fields["Prep Master Name"] ?? "Your PrepMaster"} confirmed your session on ${booking.fields.Date ?? ""}.`,
          bookingId,
          pushData: { route: "/member/bookings" },
        }).catch(() => {})
      }

      // Notify dancer via email
      const dancerEmail = booking.fields["Client Email"]
      const dancerName = dancerEmail ?? "Member"
      const pmName = booking.fields["Prep Master Name"] ?? "your PrepMaster"
      const date = booking.fields.Date ?? ""
      const time = booking.fields.Time ?? ""
      if (dancerEmail) {
        const { sendEmail: _send, bookingConfirmationEmail } = await import("@/lib/email")
        const { getParentEmailForMember } = await import("@/lib/airtable")
        const { subject, html } = bookingConfirmationEmail({ dancerName, prepMasterName: pmName, date, time })
        const parentCC = booking.fields["User ID"] ? await getParentEmailForMember(booking.fields["User ID"]).catch(() => null) : null
        // Override subject/body to say "confirmed"
        await sendEmail({ to: dancerEmail, cc: parentCC ?? undefined, subject: `Booking confirmed — ${date} at ${time}`, html: html.replace("Booking request received", "Booking confirmed").replace("Your booking request has been submitted!", "Great news — your session has been confirmed!").replace("Your booking is pending confirmation from your PrepMaster. You will receive an email notification once they have confirmed your booking request.", "See you there! Need to cancel? Please do so at least 24 hours in advance to get your credit back.") })
      }

      // Create Google Calendar events for PM and dancer (fire-and-forget)
      ;(async () => {
        const pms = await getPrepMasters()
        const pm = pms.find((p) => p.name === (booking.fields["Prep Master Name"] ?? ""))
        if (!pm?.email) return
        const [[pmUser], dancerUserId] = await Promise.all([
          db.select({ id: userTable.id, timezone: userTable.timezone }).from(userTable).where(eq(userTable.email, pm.email)).limit(1),
          Promise.resolve(booking.fields["User ID"] ?? null),
        ])
        const pmTz = pmUser?.timezone ?? COMPANY_TZ
        const dancerName = booking.fields.Name ?? booking.fields["Client Email"] ?? "Member"
        const eventArgs = { dancerName, prepMasterName: pm.name, date: booking.fields.Date ?? "", time: booking.fields.Time ?? "", notes: booking.fields.Notes, sessionType: booking.fields["Session Type"], timezone: pmTz }
        const dancerUserRow = dancerUserId ? await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.id, dancerUserId)).limit(1).then((r) => r[0] ?? null) : null
        const [pmEventId, dancerEventId] = await Promise.all([
          pmUser ? createCalendarEvent(pmUser.id, eventArgs) : Promise.resolve(null),
          dancerUserRow ? createCalendarEvent(dancerUserRow.id, { ...eventArgs }) : Promise.resolve(null),
        ])
        const links = []
        if (pmUser && pmEventId) links.push({ id: crypto.randomUUID(), bookingId, userId: pmUser.id, gcalEventId: pmEventId })
        if (dancerUserRow && dancerEventId) links.push({ id: crypto.randomUUID(), bookingId, userId: dancerUserRow.id, gcalEventId: dancerEventId })
        if (links.length > 0) {
          await db.insert(calendarEventLink).values(links).onConflictDoNothing().catch(() => {})
        }
      })().catch(() => {})

      return new NextResponse(
        `<html><body style="font-family:sans-serif;padding:40px;max-width:480px;margin:0 auto">
          <h2 style="color:#e91e8c">Booking confirmed ✓</h2>
          <p>The session has been confirmed and the member has been notified.</p>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      )
    }

    if (action === "deny") {
      // "Declined" = PM-initiated denial; "Cancelled" is reserved for member-initiated cancellations
      await appBase.update<BookingFields>(TABLES.bookings, bookingId, { Status: "Declined" })

      // Refund credit
      const userId = booking.fields["User ID"]
      const dancerEmail = booking.fields["Client Email"]
      // Hoisted so it's accessible in the notification block below
      let clients: AirtableRecord<ClientFields>[] = []
      if (userId) {
        clients = await appBase.list<ClientFields>(TABLES.clients, {
          filterByFormula: `{User ID} = '${userId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        })
        const client = clients[0]
        if (client) {
          const SESSION_CREDIT_COST: Record<string, number> = { "pack-hour": 1, "private-60": 1, "private-45": 0.75, "private-30": 0.5, "private-90": 1.5 }
          const sessionType = booking.fields["Session Type"] as string | undefined
          const creditRefund = SESSION_CREDIT_COST[sessionType ?? "pack-hour"] ?? 1
          const current = client.fields["Credits Remaining"] ?? 0
          await appBase.update<ClientFields>(TABLES.clients, client.id, { "Credits Remaining": Math.round((current + creditRefund) * 100) / 100 })
          if (current === 0) {
            const inactivePlan = await getMostRecentInactivePlanForUser(userId)
            if (inactivePlan) await setPlanStatus(inactivePlan.id, "Active")
          }
        }
      }

      // In-app notification for dancer
      const deniedDancerUserId = booking.fields["User ID"]
      if (deniedDancerUserId) {
        const { createNotification } = await import("@/app/actions/notifications")
        createNotification({
          userId: deniedDancerUserId,
          type: "booking_cancelled",
          title: "Booking declined",
          body: `${booking.fields["Prep Master Name"] ?? "Your PrepMaster"} declined your session on ${booking.fields.Date ?? ""}. Your credit has been refunded.`,
          bookingId,
          pushData: { route: "/member/bookings" },
        }).catch(() => {})
      }

      // Notify dancer via email
      if (dancerEmail) {
        const pmName = booking.fields["Prep Master Name"] ?? "your PrepMaster"
        const date = booking.fields.Date ?? ""
        const time = booking.fields.Time ?? ""
        const parentCC = clients[0]?.fields?.["Parent Email"] ?? null
        const { subject, html } = bookingCancelledEmail({
          dancerName: dancerEmail,
          prepMasterName: pmName,
          date,
          time,
          creditRefunded: true,
        })
        await sendEmail({ to: dancerEmail, cc: parentCC ?? undefined, subject, html })
      }

      // Delete any calendar events that may exist (fire-and-forget)
      db.select({ userId: calendarEventLink.userId, gcalEventId: calendarEventLink.gcalEventId })
        .from(calendarEventLink).where(eq(calendarEventLink.bookingId, bookingId))
        .then((links) => { for (const { userId, gcalEventId } of links) deleteCalendarEvent(userId, gcalEventId).catch(() => {}) })
        .catch(() => {})

      return new NextResponse(
        `<html><body style="font-family:sans-serif;padding:40px;max-width:480px;margin:0 auto">
          <h2>Booking denied</h2>
          <p>The booking has been cancelled and the member's credit has been refunded.</p>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      )
    }
  } catch (err) {
    console.error("Booking confirm error:", err)
  }

  return NextResponse.redirect(`${APP_URL}/dashboard`)
}
