export const dynamic = "force-dynamic"

import Link from "next/link"
import { isAirtableConfigured } from "@/lib/airtable"
import { getOrCreateProfile, getMyPlans } from "@/app/actions/profile"
import type { MemberPlan } from "@/lib/airtable"
import { planDisplayStatus } from "@/lib/plan-utils"
import { getBookingsForUserId, type Booking } from "@/app/actions/booking"
import { getAvailabilityForEmail } from "@/app/actions/availability"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarPlus, Ticket, CalendarClock, AlertTriangle, Package } from "lucide-react"
import { AirtableSetupNotice } from "@/components/airtable-setup-notice"
import { BookingRow } from "@/components/booking-row"
import { getSessionUserWithRole } from "@/lib/roles"
import type { DayAvailability } from "@/lib/availability"

export default async function DashboardPage() {
  const t0 = Date.now()
  console.log("[page] start")
  const user = await getSessionUserWithRole()
  console.log("[page] got user", Date.now() - t0 + "ms")
  const firstName = user?.name?.split(" ")[0] ?? "Dancer"

  if (!isAirtableConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <Greeting name={firstName} />
        <AirtableSetupNotice />
      </div>
    )
  }

  let credits = 0
  let bookings: Booking[] = []
  let plans: MemberPlan[] = []
  let error: string | null = null

  const isAdminPreview = user?.role === "admin"
  try {
    console.log("[page] fetching profile/bookings/plans")
    if (isAdminPreview) {
      // For admin preview only fetch bookings — avoids extra DB round-trips
      // from re-resolving the session inside getOrCreateProfile/getMyPlans.
      bookings = await getBookingsForUserId(user!.id)
    } else {
      const [profile, myBookings, myPlans] = await Promise.all([
        getOrCreateProfile(),
        getBookingsForUserId(user!.id),
        getMyPlans(),
      ])
      credits = profile.creditsRemaining
      bookings = myBookings
      plans = myPlans
    }
    console.log("[page] got profile/bookings/plans", Date.now() - t0 + "ms")
  } catch (err) {
    console.log("[page] error in data fetch", Date.now() - t0 + "ms", err)
    error = err instanceof Error ? err.message : "Something went wrong."
  }

  const todayMs = new Date(new Date().toDateString()).getTime()
  function bookingMs(date: string) {
    return new Date(`${date}T00:00:00`).getTime()
  }
  const upcoming = bookings.filter((b) => {
    if (b.status.toLowerCase() === "cancelled") return false
    const ms = bookingMs(b.date)
    return !Number.isNaN(ms) && ms >= todayMs
  })
  const past = bookings
    .filter((b) => {
      if (b.status.toLowerCase() === "cancelled") return false
      const ms = bookingMs(b.date)
      return !Number.isNaN(ms) && ms < todayMs
    })
    .sort((a, b) => bookingMs(b.date) - bookingMs(a.date))
  const cancelled = bookings
    .filter((b) => b.status.toLowerCase() === "cancelled")
    .sort((a, b) => bookingMs(b.date) - bookingMs(a.date))

  // Availability powers the reschedule date picker but is non-critical.
  // Skipping this fetch avoids hanging on stale Neon TCP connections.
  const availabilityMap: Record<string, DayAvailability[]> = {}

  return (
    <div className="flex flex-col gap-8">
      <Greeting name={firstName} />

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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Ticket className="size-4 text-primary" />
              Session credits
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="font-heading text-4xl font-bold">{credits}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {credits > 0
                  ? "Ready to use on private sessions."
                  : "Purchase a package to start booking."}
            </p>
            </div>
            {plans.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t pt-3">
                {plans.map((plan) => (
                  <div key={plan.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Package className="size-3.5 text-primary" />
                      {plan.planName}
                    </span>
                    <Badge
                      variant="outline"
                      className={`capitalize text-xs ${planDisplayStatus(plan) === "Active" ? "border-green-300 bg-green-100 text-green-700" : planDisplayStatus(plan) === "Used" ? "border-amber-300 bg-amber-100 text-amber-700" : "border-gray-200 bg-gray-100 text-gray-500"}`}
                    >
                      {planDisplayStatus(plan)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarPlus className="size-4 text-primary" />
              Ready to train?
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Browse prep masters and book your next private session.
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
                When you book a private session with a prep master, it will appear here.
              </p>
              <Button asChild variant="outline">
                <Link href="/dashboard/coaches">Find a prep master</Link>
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
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-bold tracking-tight text-muted-foreground">Cancelled sessions</h2>
          <ul className="flex flex-col gap-3 opacity-60">
            {cancelled.map((b) => (
              <li key={b.id}>
                <BookingRow booking={b} availability={[]} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Greeting({ name }: { name: string }) {
  return (
    <div>
      <h1 className="font-heading text-3xl font-bold tracking-tight">
        Welcome back, {name}.
      </h1>
      <p className="mt-1 text-muted-foreground">
        Here&apos;s what&apos;s happening with your training.
      </p>
    </div>
  )
}
