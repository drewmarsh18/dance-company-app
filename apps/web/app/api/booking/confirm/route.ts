import { NextRequest, NextResponse } from "next/server"
import { appBase, TABLES, type BookingFields, type ClientFields, getMostRecentInactivePlanForUser, setPlanStatus } from "@/lib/airtable"
import { sendEmail, bookingCancelledEmail } from "@/lib/email"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dance-company-app.vercel.app"
const SECRET = process.env.BOOKING_CONFIRM_SECRET ?? "cdp-confirm-secret"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get("id")
  const action = searchParams.get("action") // "approve" | "deny"
  const token = searchParams.get("token")

  if (!bookingId || !action || token !== SECRET) {
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

      // Notify dancer
      const dancerEmail = booking.fields["Client Email"]
      const dancerName = dancerEmail ?? "Member"
      const pmName = booking.fields["PrepMaster Name"] ?? "your PrepMaster"
      const date = booking.fields.Date ?? ""
      const time = booking.fields.Time ?? ""
      if (dancerEmail) {
        const { sendEmail: _send, bookingConfirmationEmail } = await import("@/lib/email")
        const { subject, html } = bookingConfirmationEmail({ dancerName, prepMasterName: pmName, date, time })
        // Override subject/body to say "confirmed"
        await sendEmail({ to: dancerEmail, subject: `Booking confirmed — ${date} at ${time}`, html: html.replace("Booking request received", "Booking confirmed").replace("Your booking request has been submitted!", "Great news — your session has been confirmed!").replace("Your booking is pending confirmation from your PrepMaster. You will receive an email notification once they have confirmed your booking request.", "See you there! Need to cancel? Please do so at least 24 hours in advance to get your credit back.") })
      }

      return new NextResponse(
        `<html><body style="font-family:sans-serif;padding:40px;max-width:480px;margin:0 auto">
          <h2 style="color:#e91e8c">Booking confirmed ✓</h2>
          <p>The session has been confirmed and the member has been notified.</p>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      )
    }

    if (action === "deny") {
      await appBase.update<BookingFields>(TABLES.bookings, bookingId, { Status: "Cancelled" })

      // Refund credit
      const userId = booking.fields["User ID"]
      const dancerEmail = booking.fields["Client Email"]
      if (userId) {
        const clients = await appBase.list<ClientFields>(TABLES.clients, {
          filterByFormula: `{User ID} = '${userId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        })
        const client = clients[0]
        if (client) {
          const current = client.fields["Credits Remaining"] ?? 0
          await appBase.update<ClientFields>(TABLES.clients, client.id, { "Credits Remaining": current + 1 })
          if (current === 0) {
            const inactivePlan = await getMostRecentInactivePlanForUser(userId)
            if (inactivePlan) await setPlanStatus(inactivePlan.id, "Active")
          }
        }
      }

      // Notify dancer
      if (dancerEmail) {
        const pmName = booking.fields["PrepMaster Name"] ?? "your PrepMaster"
        const date = booking.fields.Date ?? ""
        const time = booking.fields.Time ?? ""
        const { subject, html } = bookingCancelledEmail({
          dancerName: dancerEmail,
          prepMasterName: pmName,
          date,
          time,
          creditRefunded: true,
        })
        await sendEmail({ to: dancerEmail, subject, html })
      }

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
