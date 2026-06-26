import { isAirtableConfigured } from "@/lib/airtable"
import { getOrCreateProfile, type ClientProfile } from "@/app/actions/profile"
import { ProfileForm } from "@/components/profile-form"
import { AirtableSetupNotice } from "@/components/airtable-setup-notice"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Ticket } from "lucide-react"

export default async function ProfilePage() {
  if (!isAirtableConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <AirtableSetupNotice />
      </div>
    )
  }

  let profile: ClientProfile | null = null
  let error: string | null = null

  try {
    profile = await getOrCreateProfile()
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load your profile."
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Header />

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 py-5 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : profile ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your details</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm profile={profile} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="font-heading text-3xl font-bold tracking-tight">
        Your profile
      </h1>
      <p className="mt-1 text-muted-foreground">
        Keep your details up to date so your Prep Masters know your goals.
      </p>
    </div>
  )
}
