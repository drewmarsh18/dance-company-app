import "server-only"
import twilio from "twilio"

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null

export async function sendSms(to: string, body: string): Promise<void> {
  if (!client || !process.env.TWILIO_FROM_NUMBER) {
    console.warn("Twilio not configured — skipping SMS.")
    return
  }
  // Normalize to E.164 if a 10-digit US number is stored without country code
  const normalized = to.replace(/\D/g, "")
  const e164 = normalized.startsWith("1") ? `+${normalized}` : `+1${normalized}`

  await client.messages.create({
    from: process.env.TWILIO_FROM_NUMBER,
    to: e164,
    body,
  })
}
