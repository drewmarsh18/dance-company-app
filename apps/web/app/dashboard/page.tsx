export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import Link from "next/link"
import { isAirtableConfigured } from "@/lib/airtable"
import { getOrCreateProfile, getMyPlans } from "@/app/actions/profile"
import type { MemberPlan } from "@/lib/airtable"
import { getBookingsForUserId, type Booking } from "@/app/actions/booking"
import { getAvailabilityForEmail } from "@/app/actions/availability"
import { getPrepMasters } from "@/lib/airtable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarPlus, Ticket, CalendarClock, AlertTriangle } from "lucide-react"
import { AirtableSetupNotice } from "@/components/airtable-setup-notice"
import { BookingRow } from "@/components/booking-row"
import { CreditsCard } from "@/components/credits-card"
import { CollapsibleSection } from "@/components/collapsible-section"
import { getSessionUserWithRole } from "@/lib/roles"
import type { DayAvailability } from "@/lib/availability"

export default async function DashboardPage() {
  const t0 = Date.now()
  console.log("[page] start")
  const user = await getSessionUserWithRole()
  console.log("[page] got user", Date.now() - t0 + "ms")

  if (!isAirtableConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <Greeting name={user?.name?.split(" ")[0] ?? "Dancer"} isParent={false} />
        <AirtableSetupNotice />
      </div>
    )
  }

  // PrepMasters must never access the member dashboard — send them to their portal
  if (user?.role === "prep_master") redirect("/portal")

  const profileCheck = await getOrCreateProfile()
  if (profileCheck.isNewProfile) redirect("/onboarding")

  let credits = 0
  let bookings: Booking[] = []
  let plans: MemberPlan[] = []
  let error: string | null = null
  let isParent = false
  let displayName = user?.name?.split(" ")[0] ?? "Dancer"

  const resolvedUser = user ? { id: user.id, email: user.email, name: user.name ?? "" } : undefined
  const noCreate = user?.role === "admin" || user?.role === "prep_master"
  try {
    console.log("[page] fetching profile/bookings/plans")
    const profile = await getOrCreateProfile({ noCreate, resolvedUser })
    const effectiveId = profile.effectiveUserId || user!.id
    const [myBookings, myPlans] = await Promise.all([
      getBookingsForUserId(effectiveId),
      getMyPlans(effectiveId, profile.email || user!.email),
    ])
    credits = profile.creditsRemaining
    bookings = myBookings
    plans = myPlans
    isParent = profile.isParentView
    displayName = (profile.name ?? "").split(" ")[0] || displayName
    console.log("[page] got profile/bookings/plans", Date.now() - t0 + "ms")
  } catch (err) {
    console.log("[page] error in data fetch", Date.now() - t0 + "ms", err)
    error = err instanceof Error ? err.message : "Something went wrong."
  }

  const todayMs = new Date(new Date().toDateString()).getTime()
  function bookingMs(date: string) {
    return new Date(`${date}T00:00:00`).getTime()
  }
  function isInactive(status: string) {
    const s = status.toLowerCase()
    return s.startsWith("cancelled") || s === "declined"
  }
  const upcoming = bookings.filter((b) => {
    if (isInactive(b.status)) return false
    const ms = bookingMs(b.date)
    return !Number.isNaN(ms) && ms >= todayMs
  })
  const past = bookings
    .filter((b) => {
      if (isInactive(b.status)) return false
      const ms = bookingMs(b.date)
      return !Number.isNaN(ms) && ms < todayMs
    })
    .sort((a, b) => bookingMs(b.date) - bookingMs(a.date))
  const cancelled = bookings
    .filter((b) => isInactive(b.status))
    .sort((a, b) => bookingMs(b.date) - bookingMs(a.date))

  // Fetch availability for each unique prep master so the reschedule picker has dates
  const availabilityMap: Record<string, DayAvailability[]> = {}
  const uniquePrepMasterNames = [...new Set(upcoming.map((b) => b.prepMasterName).filter(Boolean))]
  if (uniquePrepMasterNames.length > 0) {
    try {
      const allPrepMasters = await getPrepMasters()
      const nameToEmail = Object.fromEntries(allPrepMasters.map((pm) => [pm.name, pm.email]))
      await Promise.all(
        uniquePrepMasterNames.map(async (name) => {
          const email = nameToEmail[name]
          if (!email) return
          try {
            availabilityMap[name] = await getAvailabilityForEmail(email)
          } catch {
            // non-critical
          }
        })
      )
    } catch {
      // non-critical
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Greeting name={displayName} isParent={isParent} />

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 py-5 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-foreground">
                We couldn&apos;t reach your Airtable backend.
              </p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <CreditsCard plans={plans} credits={credits} />

        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarPlus className="size-4 text-primary" />
              Ready to train?
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Browse PrepMasters and book your next private session.
            </p>
            <Button asChild className="w-fit">
              <Link href="/dashboard/coaches">Book a session</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl font-bold tracking-tight">Upcoming sessions</h2>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarClock className="size-10 text-muted-foreground" />
              <p className="font-medium">No upcoming sessions yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                When you book a private session with a PrepMaster, it will appear here.
              </p>
              <Button asChild variant="outline">
                <Link href="/dashboard/coaches">Find a PrepMaster</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.map((b) => (
              <li key={b.id}>
                <BookingRow booking={b} availability={availabilityMap[b.prepMasterName] ?? []} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-bold tracking-tight text-muted-foreground">Past sessions</h2>
          <ul className="flex flex-col gap-3 opacity-75">
            {past.map((b) => (
              <li key={b.id}>
                <BookingRow booking={b} availability={[]} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {cancelled.length > 0 && (
        <CollapsibleSection title="Cancelled & declined" count={cancelled.length}>
          <ul className="flex flex-col gap-3 opacity-60">
            {cancelled.map((b) => (
              <li key={b.id}>
                <BookingRow booking={b} availability={[]} />
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}
    </div>
  )
}

function Greeting({ name, isParent }: { name: string; isParent: boolean }) {
  return (
    <div>
      <h1 className="font-heading text-3xl font-bold tracking-tight">
        {isParent ? `${name}'s account` : `Welcome, ${name}.`}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {isParent
          ? `You're viewing ${name}'s sessions and credits as a parent.`
          : "Here's what's happening with your training."}
      </p>
    </div>
  )
}
