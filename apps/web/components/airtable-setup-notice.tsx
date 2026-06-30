import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Database } from "lucide-react"

export function AirtableSetupNotice() {
  return (
    <Card className="border-accent/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="size-5 text-primary" />
          Connect your Airtable backend
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          You&apos;re signed in, but the app can&apos;t reach Airtable yet. Add
          your <code className="rounded bg-muted px-1">AIRTABLE_BASE_ID</code> to
          the project environment variables to activate PrepMasters, Clients,
          and Bookings.
        </p>
        <div>
          <p className="font-medium text-foreground">Expected tables &amp; fields:</p>
          <ul className="mt-2 flex flex-col gap-2">
            <li>
              <span className="font-medium text-foreground">PrepMasters</span> —
              Name, Email, Pay Rate, Specialties, Bio, Photo, Active
            </li>
            <li>
              <span className="font-medium text-foreground">Clients</span> — Name,
              Email, User ID, Phone, Goals, Credits Remaining
            </li>
            <li>
              <span className="font-medium text-foreground">Bookings</span> —
              Client Email, User ID, PrepMaster, PrepMaster Name, Date, Time,
              Status, Notes
            </li>
          </ul>
        </div>
        <p>
          Once the base ID is set, refresh this page and your data will load
          automatically.
        </p>
      </CardContent>
    </Card>
  )
}
