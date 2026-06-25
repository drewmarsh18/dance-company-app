import {
  getPrepMasterByEmail,
  isAirtableConfigured,
  getBookingsForPrepMaster,
} from "@/lib/airtable"
import { getSessionUserWithRole } from "@/lib/roles"
import { isCalendarConnected } from "@/lib/google-calendar"
import { AirtableSetupNotice } from "@/components/airtable-setup-notice"
import { AppointmentCard } from "@/components/appointment-card"
import { GoogleCalendarButton } from "@/components/google-calendar-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default async function PortalPage() {
  const user = await getSessionUserWithRole()
  const firstName = user?.name?.split(" ")[0] ?? "there"

  if (!isAirtableConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Welcome, {firstName}</h1>
        <AirtableSetupNotice />
      </div>
    )
  }

  const prepMaster = user ? await getPrepMasterByEmail(user.email) : null

  if (!prepMaster) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Welcome, {firstName}</h1>
        <Card className="border-accent/50">
          <CardHeader>
            <CardTitle className="text-lg">Your staff record isn&apos;t linked yet</CardTitle>
            <CardDescription>
              We couldn&apos;t find a Workers record in Airtable with the email{" "}
              <span className="font-medium">{user?.email}</span>. Ask your admin to add a row in
              the Workers table (marked Active) using this exact email, then refresh.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const [bookings, calendarConnected] = await Promise.all([
    getBookingsForPrepMaster(prepMaster.name),
    user ? isCalendarConnected(user.id) : Promise.resolve(false),
  ])
  const today = startOfToday()
  const upcoming = bookings.filter(
    (b) => !b.date || new Date(`${b.date}T00:00:00`) >= today,
  )
  const past = bookings.filter(
    (b) => b.date && new Date(`${b.date}T00:00:00`) < today,
  )
  const pendingCount = upcoming.filter((b) => b.status.toLowerCase() === "pending").length

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Welcome, {firstName}</h1>
          <p className="mt-1 text-muted-foreground">
            Here are your private sessions. Confirm or decline any pending requests.
          </p>
        </div>
        <GoogleCalendarButton connected={calendarConnected} />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-xl font-semibold">Upcoming sessions</h2>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="rounded-full">
              {pendingCount} pending
            </Badge>
          )}
        </div>

        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No upcoming sessions booked yet.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map((b) => (
              <AppointmentCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-semibold text-muted-foreground">Past sessions</h2>
          <div className="flex flex-col gap-3 opacity-75">
            {past.map((b) => (
              <AppointmentCard key={b.id} booking={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
