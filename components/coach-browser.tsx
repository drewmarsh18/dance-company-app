"use client"

import { useMemo, useState } from "react"
import type { PrepMaster } from "@/lib/airtable"
import { CoachCard } from "@/components/coach-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ALL = "All regions"

export function CoachBrowser({ coaches }: { coaches: PrepMaster[] }) {
  const [region, setRegion] = useState(ALL)

  // Unique, sorted list of regions present in the roster.
  const regions = useMemo(() => {
    const set = new Set<string>()
    for (const c of coaches) {
      if (c.region) set.add(c.region)
    }
    return [ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [coaches])

  const filtered = useMemo(
    () =>
      region === ALL
        ? coaches
        : coaches.filter((c) => c.region === region),
    [coaches, region],
  )

  return (
    <div className="flex flex-col gap-5">
      {regions.length > 1 ? (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter Prep Masters by region"
        >
          {regions.map((r) => {
            const active = r === region
            return (
              <Button
                key={r}
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setRegion(r)}
                aria-pressed={active}
                className={cn("rounded-full", !active && "text-muted-foreground")}
              >
                {r}
              </Button>
            )
          })}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No Prep Masters in {region}.
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
