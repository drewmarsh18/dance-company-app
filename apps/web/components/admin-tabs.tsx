"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { AdminMember, AdminBooking, AdminWorker, MemberPlan } from "@/lib/airtable"
import type { DancePackage } from "@/lib/packages"
import { AdminMembersPanel } from "@/components/admin-members-panel"

import { AdminPrepMastersPanel } from "@/components/admin-prep-masters-panel"
import { AdminOverviewPanel } from "@/components/admin-overview-panel"
import { Search } from "lucide-react"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "members", label: "Members" },
  { id: "prep-masters", label: "PrepMasters" },
] as const

type TabId = (typeof TABS)[number]["id"]

const SEARCHABLE_TABS = new Set<TabId>(["members", "prep-masters"])

const SEARCH_PLACEHOLDERS: Partial<Record<TabId, string>> = {
  members: "Search members…",
  "prep-masters": "Search PrepMasters…",
}

type Props = {
  members: AdminMember[]
  bookings: AdminBooking[]
  workers: AdminWorker[]
  plans: MemberPlan[]
  packages: DancePackage[]
}

export function AdminTabs({ members, bookings, workers, plans, packages }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab") as TabId | null
  const [active, setActive] = useState<TabId>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "overview"
  )
  const [queries, setQueries] = useState<Partial<Record<TabId, string>>>({})

  function switchTab(id: TabId) {
    setActive(id)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", id)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const query = queries[active] ?? ""
  const setQuery = (v: string) => setQueries((prev) => ({ ...prev, [active]: v }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex gap-1 rounded-lg border bg-muted p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                active === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {SEARCHABLE_TABS.has(active) && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder={SEARCH_PLACEHOLDERS[active]}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex h-9 w-full sm:w-64 rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        )}
      </div>

      {active === "overview" && <AdminOverviewPanel members={members} bookings={bookings} workers={workers} />}
      {active === "members" && (
        <AdminMembersPanel members={members} bookings={bookings} plans={plans} packages={packages} query={query} />
      )}
      {active === "prep-masters" && (
        <AdminPrepMastersPanel workers={workers} bookings={bookings} query={query} />
      )}
    </div>
  )
}
