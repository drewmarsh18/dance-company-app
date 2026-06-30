import { isAirtableConfigured, getPrepMasters, type PrepMaster } from "@/lib/airtable"
import { CoachBrowser } from "@/components/coach-browser"
import { AirtableSetupNotice } from "@/components/airtable-setup-notice"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, Users } from "lucide-react"

export default async function CoachesPage() {
  if (!isAirtableConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <AirtableSetupNotice />
      </div>
    )
  }

  let coaches: PrepMaster[] = []
  let error: string | null = null

  try {
    coaches = await getPrepMasters()
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load PrepMasters."
  }

  return (
    <div className="flex flex-col gap-6">
      <Header />

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 py-5 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : coaches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="size-10 text-muted-foreground" />
            <p className="font-medium">No PrepMasters available yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add active records to your Airtable{" "}
              <code className="rounded bg-muted px-1">Workers</code> table to see
              them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <CoachBrowser coaches={coaches} />
      )}
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="font-heading text-3xl font-bold tracking-tight">
        Choose your PrepMaster
      </h1>
      <p className="mt-1 text-muted-foreground">
        Browse our expert coaches and pick the right fit for your next session.
      </p>
    </div>
  )
}
