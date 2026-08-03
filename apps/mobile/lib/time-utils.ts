/** Formats a "HH:MM" or "H:MM AM/PM" time string as "3:00 PM" */
export function fmtTime(timeStr: string): string {
  if (!timeStr) return timeStr
  if (/am|pm/i.test(timeStr)) return timeStr
  const [h, m] = timeStr.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return timeStr
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}

/** Returns the short timezone abbreviation for the device locale, e.g. "MDT", "EST", "PDT" */
export function getTimezoneAbbr(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(new Date())
    return parts.find((p) => p.type === "timeZoneName")?.value ?? ""
  } catch {
    return ""
  }
}

/** Formats a time string with the device timezone abbreviation, e.g. "3:00 PM MDT" */
export function fmtTimeWithTZ(timeStr: string): string {
  const t = fmtTime(timeStr)
  const tz = getTimezoneAbbr()
  return tz ? `${t} ${tz}` : t
}

/** Formats a YYYY-MM-DD date string as "Tuesday, June 30, 2026" */
export function fmtDate(dateIso: string): string {
  if (!dateIso) return dateIso
  const d = new Date(`${dateIso}T00:00:00`)
  if (isNaN(d.getTime())) return dateIso
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}
