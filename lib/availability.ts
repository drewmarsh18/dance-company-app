// Shared availability types + pure slot-generation helpers.
// No server-only imports here so both client and server can use these.

export const WEEKDAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
] as const

/** A prep master's availability window for a single weekday. */
export type DayAvailability = {
  dayOfWeek: number // 0 = Sunday … 6 = Saturday
  enabled: boolean
  startTime: string // "HH:MM" 24h
  endTime: string // "HH:MM" 24h
}

/** Sensible default when a prep master hasn't configured a day yet. */
export const DEFAULT_START = "15:00"
export const DEFAULT_END = "19:00"

/** Builds a full 7-day template, merging in any saved windows. */
export function buildWeekTemplate(
  saved: DayAvailability[],
): DayAvailability[] {
  return WEEKDAYS.map((d) => {
    const match = saved.find((s) => s.dayOfWeek === d.value)
    return (
      match ?? {
        dayOfWeek: d.value,
        enabled: false,
        startTime: DEFAULT_START,
        endTime: DEFAULT_END,
      }
    )
  })
}

/** "15:00" -> "3:00 PM" */
export function to12Hour(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":")
  let h = Number(hStr)
  const m = mStr ?? "00"
  const period = h >= 12 ? "PM" : "AM"
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m} ${period}`
}

/**
 * Generates display-formatted hourly slots within [startTime, endTime).
 * e.g. start "15:00", end "18:00" -> ["3:00 PM", "4:00 PM", "5:00 PM"].
 */
export function generateHourlySlots(
  startTime: string,
  endTime: string,
): string[] {
  const start = Number(startTime.split(":")[0])
  const end = Number(endTime.split(":")[0])
  const slots: string[] = []
  for (let h = start; h < end; h++) {
    slots.push(to12Hour(`${String(h).padStart(2, "0")}:00`))
  }
  return slots
}

/** Returns the available display slots for a given ISO date (YYYY-MM-DD). */
export function slotsForDate(
  dateIso: string,
  week: DayAvailability[],
): string[] {
  const day = new Date(`${dateIso}T00:00:00`).getDay()
  const config = week.find((w) => w.dayOfWeek === day)
  if (!config || !config.enabled) return []
  return generateHourlySlots(config.startTime, config.endTime)
}

/** True if the prep master has at least one enabled day. */
export function hasAnyAvailability(week: DayAvailability[]): boolean {
  return week.some((w) => w.enabled)
}
