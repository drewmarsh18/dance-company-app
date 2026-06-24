import { getMyAvailability } from "@/app/actions/availability"
import { AvailabilityEditor } from "@/components/availability-editor"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "lucide-react"

export default async function AvailabilityPage() {
  const week = await getMyAvailability()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Your availability
        </h1>
        <p className="mt-1 text-muted-foreground">
          Set the weekly hours you&apos;re open for private sessions. Dancers can
          only book within these windows.
        </p>
      </div>

      <AvailabilityEditor initialWeek={week} />

      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary">
              <Calendar className="size-5" />
            </span>
            <div>
              <p className="font-medium">Connect your Google Calendar</p>
              <p className="text-sm text-muted-foreground">
                Soon you&apos;ll be able to sync your Google Calendar so booked
                events automatically block your real-time availability.
              </p>
            </div>
          </div>
          <Button variant="outline" disabled className="shrink-0">
            Coming soon
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
