import nodemailer from "nodemailer"

const REPLY_TO = "collegedanceprep@gmail.com"
const YEAR = new Date().getFullYear()

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
    replyTo: REPLY_TO,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    html,
  })
}

function emailBase(subtitle: string, bodyHtml: string) {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
      <!-- header -->
      <tr><td style="background:#e91e8c;padding:28px 32px 24px;text-align:center;">
        <div style="color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.3px;margin-bottom:2px">College Dance Prep</div>
        <div style="color:rgba(255,255,255,0.8);font-size:13px">${subtitle}</div>
      </td></tr>
      <!-- body -->
      <tr><td style="padding:28px 32px">${bodyHtml}</td></tr>
      <!-- footer -->
      <tr><td style="padding:16px 32px 24px;text-align:center;font-size:12px;color:#9ca3af">
        &copy; ${YEAR} College Dance Prep &middot; ${REPLY_TO}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

function sessionTable(prepMasterName: string, date: string, time: string, bgColor: string, borderColor: string, labelColor: string, rowBorderColor: string) {
  const row = (label: string, value: string, last = false) =>
    `<tr>
      <td style="padding:7px 0;color:${labelColor};font-weight:500;font-size:14px;${last ? "" : `border-bottom:0.5px solid ${rowBorderColor}`}">${label}</td>
      <td style="padding:7px 0;color:#1f2937;font-weight:600;font-size:14px;text-align:right;${last ? "" : `border-bottom:0.5px solid ${rowBorderColor}`}">${value}</td>
    </tr>`
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${bgColor};border:1px solid ${borderColor};border-radius:8px;padding:16px 20px;margin:20px 0">
      ${row("Prep Master", prepMasterName)}
      ${row("Date", date)}
      ${row("Time", time, true)}
    </table>`
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
  const body = `
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px">Hi ${dancerName},</p>
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 4px">You're all set! Here are the details for your upcoming session.</p>
    ${sessionTable(prepMasterName, date, time, "#fdf2f8", "#f9a8d4", "#9d174d", "#f3e8f0")}
    <div style="font-size:13px;color:#6b7280;background:#f9fafb;border-left:3px solid #e91e8c;border-radius:0 6px 6px 0;padding:10px 14px;line-height:1.5">
      Need to cancel? Please do so at least 24 hours in advance to get your credit back.
    </div>`
  return {
    subject: `Session confirmed — ${date} at ${time}`,
    html: emailBase("Session confirmed", body),
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
  const creditBlock = creditRefunded
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;font-size:13px;color:#15803d;font-weight:500;margin-top:16px">
        ✓ Your credit has been returned to your account.
       </div>`
    : `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:10px 14px;font-size:13px;color:#92400e;font-weight:500;margin-top:16px">
        ⚠ Cancelled within 24 hours — no credit was refunded per our cancellation policy.
       </div>`
  const body = `
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px">Hi ${dancerName},</p>
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 4px">Your session has been cancelled. Here's a summary:</p>
    ${sessionTable(prepMasterName, date, time, "#fff1f2", "#fecdd3", "#9f1239", "#fde8ea")}
    ${creditBlock}`
  return {
    subject: `Session cancelled — ${date} at ${time}`,
    html: emailBase("Session cancelled", body),
  }
}
