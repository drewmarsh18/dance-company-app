"use client"

import { useEffect, useState } from "react"
import { slotToLocalTime, localTimezoneAbbr, userIsInDifferentTimezone, COMPANY_TIMEZONE } from "@/lib/time"

/**
 * Renders a time slot string in the user's local timezone.
 * Falls back to the stored string on the server (no hydration mismatch).
 */
export function LocalTime({
  slot,
  dateIso,
  className,
}: {
  slot: string
  dateIso: string
  className?: string
}) {
  const [localSlot, setLocalSlot] = useState(slot)
  const [abbr, setAbbr] = useState("")

  useEffect(() => {
    try {
      setLocalSlot(slotToLocalTime(slot, dateIso, COMPANY_TIMEZONE))
      if (userIsInDifferentTimezone()) {
        setAbbr(localTimezoneAbbr())
      }
    } catch {
      // keep original
    }
  }, [slot, dateIso])

  return (
    <span className={className}>
      {localSlot}
      {abbr && <span className="ml-1 text-xs opacity-60">{abbr}</span>}
    </span>
  )
}
