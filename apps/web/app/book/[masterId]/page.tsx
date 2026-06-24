import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import {
  isAirtableConfigured,
  getPrepMaster,
  getUpcomingBookedSlots,
} from "@/lib/airtable"
import { getAvailabilityForEmail } from "@/app/actions/availability"
import { getOrCreateProfile } from "@/app/actions/profile"
import { hasAnyAvailability, buildWeekTemplate } from "@/lib/availability"
import { BookingFlow } from "@/components/booking-flow"
import { BrandLogo } from "@/components/brand-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, CalendarX, Ticket } from "lucide-react"

export default async function BookPage({
  params,
}: {
  params: Promise<{ masterId: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/")

  if (!isAirtableConfigured()) redirect("/dashboard")

  const { masterId } = await params
  const coach = await getPrepMaster(masterId)
  if (!coach) notFound()

  const [savedAvailability, bookedSlots, profile] = await Promise.all([
    getAvailabilityForEmail(coach.email),
    getUpcomingBookedSlots(coach.name),
    getOrCreateProfile(),
  ])
  const week = buildWeekTemplate(savedAvailability)
  const credits = profile.creditsRemaining

  const initials = coach.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link href="/dashboard" aria-label="College Dance Prep home">
            <BrandLogo />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/coaches">
              <ArrowLeft className="size-4" />
              All Prep Masters
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-8 flex items-center gap-4">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-accent font-heading text-2xl font-semibold text-primary">
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-primary">Booking a session with</p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {coach.name}
            </h1>
            {coach.region ? (
              <Badge variant="secondary" className="mt-1.5 font-normal">
                {coach.region}
              </Badge>
            ) : null}
          </div>
        </div>

        {credits < 1 ? (
          <NoCreditsNotice />
        ) : !hasAnyAvailability(week) ? (
          <NoAvailabilityNotice name={coach.name} />
        ) : (
          <BookingFlow
            prepMasterId={coach.id}
            prepMasterName={coach.name}
            week={week}
            bookedSlots={bookedSlots}
            credits={credits}
          />
        )}
      </main>
    </div>
  )
}

function NoCreditsNotice() {
  return (
    <Card className="border-accent/50">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-accent text-primary">
          <Ticket className="size-6" />
        </span>
        <div>
          <p className="font-heading text-lg font-semibold">
            You&apos;re out of session credits
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Booking a private session costs 1 credit. Purchase a package to keep
            training with your Prep Masters.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/packages">View packages</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function NoAvailabilityNotice({ name }: { name: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
          <CalendarX className="size-6" />
        </span>
        <div>
          <p className="font-heading text-lg font-semibold">
            No open hours right now
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {name} hasn&apos;t set their weekly availability yet. Check back soon
            or reach out to your admin.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/coaches">Browse other Prep Masters</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
