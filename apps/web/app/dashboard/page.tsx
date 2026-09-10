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
import { CalendarPlus, CalendarClock, AlertTriangle } from "lucide-react"
import { AirtableSetupNotice } from "@/components/airtable-setup-notice"
import { CreditsCard } from "@/components/credits-card"
import { GoogleCalendarButton } from "@/components/google-calendar-button"
import { MemberTabView } from "@/components/member-tab-view"
import { getSessionUserWithRole } from "@/lib/roles"
import { isCalendarConnected } from "@/lib/google-calendar"
import type { DayAvailability } from "@/lib/availability"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"

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
  let calendarConnected = false

  const resolvedUser = user ? { id: user.id, email: user.email, name: user.name ?? "" } : undefined
  const noCreate = user?.role === "admin" || user?.role === "prep_master"
  try {
    console.log("[page] fetching profile/bookings/plans")
    const profile = await getOrCreateProfile({ noCreate, resolvedUser })
    const effectiveId = profile.effectiveUserId || user!.id
    const [myBookings, myPlans, calConn] = await Promise.all([
      getBookingsForUserId(effectiveId),
      getMyPlans(effectiveId, profile.email || user!.email),
      user ? isCalendarConnected(user.id) : Promise.resolve(false),
    ])
    credits = profile.creditsRemaining
    bookings = myBookings
    plans = myPlans
    calendarConnected = calConn
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

  // Fetch availability + timezone for each unique prep master so the reschedule picker works
  const availabilityMap: Record<string, DayAvailability[]> = {}
  const timezoneMap: Record<string, string | null> = {}
  const uniquePrepMasterNames = [...new Set(upcoming.map((b) => b.prepMasterName).filter(Boolean))]
  if (uniquePrepMasterNames.length > 0) {
    try {
      const allPrepMasters = await getPrepMasters()
      const nameToEmail = Object.fromEntries(allPrepMasters.map((pm) => [pm.name, pm.email]))
      const pmEmails = uniquePrepMasterNames.map((n) => nameToEmail[n]).filter(Boolean) as string[]
      const [tzRows] = await Promise.all([
        pmEmails.length > 0
          ? db.select({ email: userTable.email, timezone: userTable.timezone }).from(userTable).where(inArray(userTable.email, pmEmails))
          : Promise.resolve([]),
      ])
      const emailToTz = Object.fromEntries(tzRows.map((r) => [r.email, r.timezone]))
      await Promise.all(
        uniquePrepMasterNames.map(async (name) => {
          const email = nameToEmail[name]
          if (!email) return
          timezoneMap[name] = emailToTz[email] ?? null
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <Greeting name={displayName} isParent={isParent} />
        <GoogleCalendarButton connected={calendarConnected} />
      </div>

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

      <MemberTabView
        upcoming={upcoming}
        past={past}
        cancelled={cancelled}
        credits={credits}
        plans={plans}
        calendarConnected={calendarConnected}
        availabilityMap={availabilityMap}
        timezoneMap={timezoneMap}
      />
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
