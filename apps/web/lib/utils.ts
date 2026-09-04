import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const COMPANY_TZ = process.env.NEXT_PUBLIC_COMPANY_TIMEZONE ?? "America/New_York"

/**
 * Converts a stored date ("YYYY-MM-DD") + 12-hour time ("3:00 PM") in the
 * company timezone (ET by default) to a UTC ISO string.
 * Used when writing bookings and reschedules to Airtable.
 */
export function etToUtcIso(date: string, timeStr: string, tz = COMPANY_TZ): string | null {
  const match = timeStr.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i)
  if (!match) return null
  let h = parseInt(match[1])
  const m = match[2] ? parseInt(match[2]) : 0
  if (match[3].toUpperCase() === "PM" && h !== 12) h += 12
  if (match[3].toUpperCase() === "AM" && h === 12) h = 0

  const [year, mo, day] = date.split("-").map(Number)
  // Seed with UTC-5 estimate, then correct using Intl to handle DST automatically.
  const seed = new Date(Date.UTC(year, mo - 1, day, h + 5, m))
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(seed)
  const etH = parseInt(parts.find((p) => p.type === "hour")!.value)
  const etM = parseInt(parts.find((p) => p.type === "minute")!.value)
  const diffMs = ((etH * 60 + etM) - (h * 60 + m)) * 60_000
  return new Date(seed.getTime() - diffMs).toISOString()
}

/**
 * Returns true if the session (stored in company timezone) is within 24 hours of now.
 * Uses etToUtcIso so DST and the server's own timezone never affect the result.
 */
export function isWithin24Hours(date: string, time: string): boolean {
  const utcIso = etToUtcIso(date, time)
  if (!utcIso) return false
  return new Date(utcIso).getTime() - Date.now() < 24 * 60 * 60 * 1000
}

/**
 * Formats a UTC ISO string for a notification body, showing the time in two
 * timezones: the sender's (e.g. PrepMaster) and the recipient's (e.g. member).
 * Returns e.g. "12:00 PM MT (2:00 PM ET)" or just "12:00 PM MT" if both are the same.
 */
export function fmtTimeForNotif(utcIso: string, senderTz: string, recipientTz?: string | null): string {
  const d = new Date(utcIso)
  function fmt(tz: string) {
    return d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
  }
  function abbr(tz: string) {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? tz
  }
  const senderStr = `${fmt(senderTz)} ${abbr(senderTz)}`
  if (!recipientTz || recipientTz === senderTz) return senderStr
  const recipStr = `${fmt(recipientTz)} ${abbr(recipientTz)}`
  if (senderStr === recipStr) return senderStr
  return `${senderStr} (${recipStr} your time)`
}

/** Formats a YYYY-MM-DD date string as "Wed, Jul 15" — matches the app display format. */
export function fmtDate(dateIso: string): string {
  if (!dateIso) return dateIso
  const d = new Date(`${dateIso}T00:00:00`)
  if (isNaN(d.getTime())) return dateIso
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}

/** Normalises a time string to 12-hour display format (e.g. "15:00" → "3:00 PM", "3:00 PM" → "3:00 PM"). */
export function fmtTime(timeStr: string): string {
  if (!timeStr) return timeStr
  if (/am|pm/i.test(timeStr)) return timeStr
  const [h, m] = timeStr.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return timeStr
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}
