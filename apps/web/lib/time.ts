// Timezone utilities for converting stored time strings to the user's local timezone.
// Stored times (e.g., "9:00 AM") are in COMPANY_TIMEZONE (set via env).

export const COMPANY_TIMEZONE =
  process.env.NEXT_PUBLIC_COMPANY_TIMEZONE ?? "America/New_York"

/** Converts "9:00 AM" → 24-hour { hours, minutes }. */
function parse12Hour(slot: string): { hours: number; minutes: number } {
  const [timePart, period] = slot.split(" ")
  let [h, m] = timePart.split(":").map(Number)
  if (period === "PM" && h !== 12) h += 12
  if (period === "AM" && h === 12) h = 0
  return { hours: h, minutes: m ?? 0 }
}

/**
 * Converts a stored time slot ("9:00 AM") on a given date ("2026-06-25")
 * from the company timezone to the user's browser local timezone.
 * Returns a formatted string like "9:00 AM" or "6:00 AM" depending on offset.
 *
 * Works by constructing a fake UTC date that represents the wall-clock time
 * in the source timezone, then formatting in the target timezone.
 */
export function slotToLocalTime(slot: string, dateIso: string, companyTz = COMPANY_TIMEZONE): string {
  const { hours, minutes } = parse12Hour(slot)
  const pad = (n: number) => String(n).padStart(2, "0")

  // Create a date as if it's that exact wall-clock time in the company timezone.
  // We use a string that JS parses as local, then shift by the timezone offset.
  const wallClock = new Date(`${dateIso}T${pad(hours)}:${pad(minutes)}:00`)

  // Find how far the company timezone is from UTC at this moment.
  // toLocaleString in the target tz gives us the "local reading" of the UTC instant.
  const utcMs = wallClock.getTime()
  const companyReading = new Date(wallClock.toLocaleString("en-US", { timeZone: companyTz }))
  const localReading = new Date(wallClock.toLocaleString("en-US"))
  const companyOffset = utcMs - companyReading.getTime()
  const localOffset = utcMs - localReading.getTime()

  const converted = new Date(utcMs + companyOffset - localOffset)

  return converted.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

/** Returns true if the user's browser timezone differs from the company timezone. */
export function userIsInDifferentTimezone(companyTz = COMPANY_TIMEZONE): boolean {
  try {
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return userTz !== companyTz
  } catch {
    return false
  }
}

/** Short timezone abbreviation for the user's browser, e.g. "EST", "PST". */
export function localTimezoneAbbr(): string {
  return new Date().toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop() ?? ""
}
