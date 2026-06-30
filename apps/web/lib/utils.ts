import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isWithin24Hours(date: string, time: string): boolean {
  const dt = new Date(`${date} ${time}`)
  if (Number.isNaN(dt.getTime())) return false
  return dt.getTime() - Date.now() < 24 * 60 * 60 * 1000
}

/** Formats a YYYY-MM-DD date string as "Wed, Jul 15" — matches the app display format. */
export function fmtDate(dateIso: string): string {
  if (!dateIso) return dateIso
  const d = new Date(`${dateIso}T00:00:00`)
  if (isNaN(d.getTime())) return dateIso
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

/** Normalises a time string to 12-hour display format (e.g. "15:00" → "3:00 PM", "3:00 PM" → "3:00 PM"). */
export function fmtTime(timeStr: string): string {
  if (!timeStr) return timeStr
  if (/am|pm/i.test(timeStr)) return timeStr
  const [h, m] = timeStr.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return timeStr
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}
