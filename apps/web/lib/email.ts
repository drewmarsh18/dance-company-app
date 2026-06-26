import nodemailer from "nodemailer"

const REPLY_TO = "collegedanceprep@gmail.com"
const YEAR = new Date().getFullYear()

function getTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_FROM,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
}) {
  if (!process.env.GMAIL_APP_PASSWORD) return
  const transporter = getTransporter()
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

/** Returns the first name from a full name, or the local part of an email. */
function firstName(nameOrEmail: string): string {
  if (!nameOrEmail) return "there"
  if (nameOrEmail.includes("@")) return nameOrEmail.split("@")[0]
  return nameOrEmail.split(" ")[0]
}

function sessionTable(rows: { label: string; value: string }[]) {
  const rowHtml = rows.map(({ label, value }, i) => {
    const last = i === rows.length - 1
    return `<tr>
      <td style="padding:8px 0;color:#6b7280;font-size:14px;${last ? "" : "border-bottom:1px solid #f3f4f6"}">${label}</td>
      <td style="padding:8px 0;color:#111827;font-weight:600;font-size:14px;text-align:right;${last ? "" : "border-bottom:1px solid #f3f4f6"}">${value}</td>
    </tr>`
  }).join("")
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:4px 16px;margin:20px 0">
      ${rowHtml}
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
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px">Hi ${firstName(dancerName)},</p>
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 4px">Your booking request has been submitted! Here are the details:</p>
    ${sessionTable([
      { label: "Prep Master", value: prepMasterName },
      { label: "Date", value: date },
      { label: "Time", value: time },
    ])}
    <div style="font-size:13px;color:#6b7280;background:#f9fafb;border-left:3px solid #e91e8c;border-radius:0 6px 6px 0;padding:10px 14px;line-height:1.5">
      Your booking is pending confirmation from your Prep Master. You will receive an email notification once they have confirmed your booking request.
    </div>`
  return {
    subject: `Booking request received — ${date} at ${time}`,
    html: emailBase("Booking request received", body),
  }
}

export function prepMasterBookingRequestEmail({
  prepMasterName,
  dancerName,
  dancerEmail,
  date,
  time,
  notes,
  approveUrl,
  denyUrl,
}: {
  prepMasterName: string
  dancerName: string
  dancerEmail: string
  date: string
  time: string
  notes?: string
  approveUrl: string
  denyUrl: string
}) {
  const rows = [
    { label: "Member", value: `${dancerName} (${dancerEmail})` },
    { label: "Date", value: date },
    { label: "Time", value: time },
    ...(notes ? [{ label: "Notes", value: notes }] : []),
  ]
  const body = `
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px">Hi ${firstName(prepMasterName)},</p>
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 4px">You have a new session request from <strong>${dancerName}</strong>.</p>
    ${sessionTable(rows)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
      <tr>
        <td style="padding-right:8px">
          <a href="${approveUrl}" style="display:block;text-align:center;background:#e91e8c;color:#ffffff;font-size:14px;font-weight:600;padding:12px 0;border-radius:8px;text-decoration:none">
            Approve
          </a>
        </td>
        <td style="padding-left:8px">
          <a href="${denyUrl}" style="display:block;text-align:center;background:#f3f4f6;color:#374151;font-size:14px;font-weight:600;padding:12px 0;border-radius:8px;text-decoration:none">
            Deny
          </a>
        </td>
      </tr>
    </table>
    <div style="font-size:13px;color:#6b7280;background:#f9fafb;border-left:3px solid #e91e8c;border-radius:0 6px 6px 0;padding:10px 14px;line-height:1.5">
      Approving will confirm the booking and notify the member. Denying will cancel it and refund their credit.
    </div>`
  return {
    subject: `New booking request — ${dancerName} on ${date} at ${time}`,
    html: emailBase("New booking request", body),
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
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px">Hi ${firstName(dancerName)},</p>
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 4px">Your session has been cancelled. Here's a summary:</p>
    ${sessionTable([
      { label: "Prep Master", value: prepMasterName },
      { label: "Date", value: date },
      { label: "Time", value: time },
    ])}
    ${creditBlock}`
  return {
    subject: `Session cancelled — ${date} at ${time}`,
    html: emailBase("Session cancelled", body),
  }
}

export function bookingUpdatedEmail({
  recipientName,
  updatedByName,
  updatedByRole,
  date,
  time,
  notes,
}: {
  recipientName: string
  updatedByName: string
  updatedByRole: "member" | "prep master"
  date: string
  time: string
  notes?: string
}) {
  const counterpart = updatedByRole === "member" ? updatedByName : updatedByName
  const rows = [
    { label: updatedByRole === "prep master" ? "Prep Master" : "Member", value: counterpart },
    { label: "Date", value: date },
    { label: "Time", value: time },
    ...(notes ? [{ label: "Notes", value: notes }] : []),
  ]
  const body = `
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px">Hi ${firstName(recipientName)},</p>
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 4px">Your session has been rescheduled by <strong>${updatedByName}</strong>. Here are the updated details:</p>
    ${sessionTable(rows)}
    <div style="font-size:13px;color:#6b7280;background:#f9fafb;border-left:3px solid #e91e8c;border-radius:0 6px 6px 0;padding:10px 14px;line-height:1.5">
      If you have any questions about this change, reply to this email.
    </div>`
  return {
    subject: `Session rescheduled — ${date} at ${time}`,
    html: emailBase("Session rescheduled", body),
  }
}
