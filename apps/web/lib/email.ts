import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.GMAIL_FROM,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
})

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
}) {
  if (!process.env.GMAIL_REFRESH_TOKEN) return
  await transporter.sendMail({
    from: `"College Dance Prep" <${process.env.GMAIL_FROM}>`,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    html,
  })
}

export function bookingConfirmationEmail({
  dancerName,
  prepMasterName,
  date,
  time,
}: {
  dancerName: string
  prepMasterName: string
  date: string
  time: string
}) {
  return {
    subject: `Session Confirmed — ${date} at ${time}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#e91e8c">College Dance Prep</h2>
        <p>Hi ${dancerName},</p>
        <p>Your session has been booked!</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px 0;color:#666;width:120px">Prep Master</td><td style="padding:8px 0;font-weight:600">${prepMasterName}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Date</td><td style="padding:8px 0;font-weight:600">${date}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Time</td><td style="padding:8px 0;font-weight:600">${time}</td></tr>
        </table>
        <p style="color:#666;font-size:14px">Need to cancel? Please do so at least 24 hours in advance to get your credit back.</p>
        <p style="color:#666;font-size:14px">— College Dance Prep</p>
      </div>
    `,
  }
}

export function bookingCancelledEmail({
  dancerName,
  prepMasterName,
  date,
  time,
  creditRefunded,
}: {
  dancerName: string
  prepMasterName: string
  date: string
  time: string
  creditRefunded: boolean
}) {
  return {
    subject: `Session Cancelled — ${date} at ${time}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#e91e8c">College Dance Prep</h2>
        <p>Hi ${dancerName},</p>
        <p>Your session has been cancelled.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px 0;color:#666;width:120px">Prep Master</td><td style="padding:8px 0;font-weight:600">${prepMasterName}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Date</td><td style="padding:8px 0;font-weight:600">${date}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Time</td><td style="padding:8px 0;font-weight:600">${time}</td></tr>
        </table>
        ${creditRefunded
          ? `<p style="color:#16a34a;font-size:14px">✓ Your credit has been returned to your account.</p>`
          : `<p style="color:#dc2626;font-size:14px">⚠ Cancelled within 24 hours — no credit was refunded per our cancellation policy.</p>`
        }
        <p style="color:#666;font-size:14px">— College Dance Prep</p>
      </div>
    `,
  }
}
