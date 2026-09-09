"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { AppointmentCard } from "@/components/appointment-card"
import type { PrepMasterBooking } from "@/lib/airtable"

type SectionKey = "completed" | "cancelled" | "declined"

const SECTION_META: Record<SectionKey, { label: string; defaultOpen: boolean }> = {
  completed: { label: "Completed", defaultOpen: false },
  cancelled: { label: "Cancelled", defaultOpen: false },
  declined: { label: "Declined", defaultOpen: false },
}

function CollapsibleGroup({
  label,
  count,
  defaultOpen,
  children,
}: {
  label: string
  count: number
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {label}
          <span className="text-xs font-normal">({count})</span>
        </span>
        {open
          ? <ChevronUp className="size-4 text-muted-foreground" />
          : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="flex flex-col gap-3 opacity-75">
          {children}
        </div>
      )}
    </div>
  )
}

export function PreviousSessionsPanel({
  completed,
  cancelled,
  declined,
}: {
  completed: PrepMasterBooking[]
  cancelled: PrepMasterBooking[]
  declined: PrepMasterBooking[]
}) {
  const sections: { key: SectionKey; items: PrepMasterBooking[] }[] = [
    { key: "completed", items: completed },
    { key: "cancelled", items: cancelled },
    { key: "declined", items: declined },
  ]

  const hasAny = sections.some((s) => s.items.length > 0)
  if (!hasAny) return null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-xl font-semibold text-muted-foreground">Previous sessions</h2>
      <div className="flex flex-col gap-4">
        {sections.map(({ key, items }) => {
          if (items.length === 0) return null
          const { label, defaultOpen } = SECTION_META[key]
          return (
            <CollapsibleGroup key={key} label={label} count={items.length} defaultOpen={defaultOpen}>
              {items.map((b) => (
                <AppointmentCard key={b.id} booking={b} />
              ))}
            </CollapsibleGroup>
          )
        })}
      </div>
    </section>
  )
}
