"use client"

import { useMemo, useState } from "react"
import type { PrepMaster } from "@/lib/airtable"
import { CoachCard } from "@/components/coach-card"
import { getUniversityColor } from "@/lib/university-colors"
import { ChevronDown, Search } from "lucide-react"

const ALL = "All universities"

export function CoachBrowser({ coaches }: { coaches: PrepMaster[] }) {
  const [selected, setSelected] = useState(ALL)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const universities = useMemo(() => {
    const set = new Set<string>()
    for (const c of coaches) {
      if (c.university) set.add(c.university)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [coaches])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return coaches.filter((c) => {
      if (selected !== ALL && c.university !== selected) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.university ?? "").toLowerCase().includes(q)
    })
  }, [coaches, selected, query])

  const activeColor = selected !== ALL ? getUniversityColor(selected) : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search by name or university */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or university…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex h-9 w-full rounded-full border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

      {universities.length > 0 && (
        <div className="relative w-fit">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            style={
              activeColor
                ? { backgroundColor: activeColor.bg, color: activeColor.text, borderColor: activeColor.bg }
                : undefined
            }
          >
            {selected === ALL ? (
              <span>Filter by university</span>
            ) : (
              <span>{selected}</span>
            )}
            <ChevronDown className="size-4 shrink-0" />
          </button>

          {open && (
            <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border bg-background shadow-lg">
              <div className="max-h-80 overflow-y-auto p-1.5">
                <button
                  onClick={() => { setSelected(ALL); setOpen(false) }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <span className="size-3 rounded-full bg-muted-foreground/30 shrink-0" />
                  All universities
                </button>

                {universities.map((u) => {
                  const { bg } = getUniversityColor(u)
                  return (
                    <button
                      key={u}
                      onClick={() => { setSelected(u); setOpen(false) }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <span
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: bg }}
                      />
                      {u}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
      </div>

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
