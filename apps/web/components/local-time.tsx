"use client"

import { useEffect, useState } from "react"
import { localTimezoneAbbr } from "@/lib/time"

/**
 * Renders a booking time in the viewer's local timezone.
 * Prefers utcDatetime (ISO string) for accuracy; falls back to raw slot string.
 */
export function LocalTime({
  slot,
  dateIso,
  utcDatetime,
  className,
}: {
  slot: string
  dateIso: string
  utcDatetime?: string | null
  className?: string
}) {
  const [localSlot, setLocalSlot] = useState(slot)
  const [abbr, setAbbr] = useState("")

  useEffect(() => {
    try {
      if (utcDatetime) {
        const d = new Date(utcDatetime)
        const formatted = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
        setLocalSlot(formatted)
        // Show tz abbreviation always when we have a real UTC source
        setAbbr(localTimezoneAbbr())
      } else {
        // Legacy fallback: raw slot string, no conversion (better than wrong conversion)
        setLocalSlot(slot)
      }
    } catch {
      setLocalSlot(slot)
    }
  }, [slot, dateIso, utcDatetime])

  return (
    <span className={className}>
      {localSlot}
      {abbr && <span className="ml-1 text-xs opacity-60">{abbr}</span>}
    </span>
  )
}
