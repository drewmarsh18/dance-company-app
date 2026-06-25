"use client"

import { useMemo, useState } from "react"
import type { PrepMaster } from "@/lib/airtable"
import { CoachCard } from "@/components/coach-card"
import { cn } from "@/lib/utils"
import { getUniversityColor } from "@/lib/university-colors"

const ALL = "All"

export function CoachBrowser({ coaches }: { coaches: PrepMaster[] }) {
  const [selected, setSelected] = useState(ALL)

  const universities = useMemo(() => {
    const set = new Set<string>()
    for (const c of coaches) {
      if (c.university) set.add(c.university)
    }
    return [ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [coaches])

  const filtered = useMemo(
    () =>
      selected === ALL
        ? coaches
        : coaches.filter((c) => c.university === selected),
    [coaches, selected],
  )

  return (
    <div className="flex flex-col gap-5">
      {universities.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter Prep Masters by university">
          {universities.map((u) => {
            const active = u === selected
            if (u === ALL) {
              return (
                <button
                  key={u}
                  onClick={() => setSelected(u)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-all border",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground",
                  )}
                >
                  All
                </button>
              )
            }
            const { bg, text } = getUniversityColor(u)
            return (
              <button
                key={u}
                onClick={() => setSelected(u)}
                aria-pressed={active}
                style={active ? { backgroundColor: bg, color: text, borderColor: bg } : undefined}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-all border",
                  active
                    ? "opacity-100 shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground",
                )}
              >
                {u}
              </button>
            )
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No Prep Masters for {selected}.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((coach) => (
            <CoachCard key={coach.id} coach={coach} />
          ))}
        </div>
      )}
    </div>
  )
}
