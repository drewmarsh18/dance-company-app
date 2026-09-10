import { isAirtableConfigured } from "@/lib/airtable"
import { getOrCreateProfile, type ClientProfile } from "@/app/actions/profile"
import { ProfileForm } from "@/components/profile-form"
import { AirtableSetupNotice } from "@/components/airtable-setup-notice"
import { GoogleCalendarButton } from "@/components/google-calendar-button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { getSessionUserWithRole } from "@/lib/roles"
import { isCalendarConnected } from "@/lib/google-calendar"
import { db } from "@/lib/db"
import { account } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

export default async function ProfilePage() {
  const user = await getSessionUserWithRole()

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
  let calendarConnected = false
  let isGoogleLinked = false

  try {
    const [p, cal, googleAccounts] = await Promise.all([
      getOrCreateProfile(),
      user ? isCalendarConnected(user.id) : Promise.resolve(false),
      user
        ? db.select({ id: account.id }).from(account).where(and(eq(account.userId, user.id), eq(account.providerId, "google"))).limit(1)
        : Promise.resolve([]),
    ])
    profile = p
    calendarConnected = cal
    isGoogleLinked = googleAccounts.length > 0
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load your profile."
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Header isParentView={profile?.isParentView ?? false} name={profile?.name ?? ""} />

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
              <ProfileForm profile={profile} isGoogleLinked={isGoogleLinked} isParentView={profile.isParentView} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connected accounts</CardTitle>
              <CardDescription>
                Link external services to enhance your CDP experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Google Calendar</p>
                  <p className="text-xs text-muted-foreground">
                    {calendarConnected
                      ? "Your sessions automatically sync to your Google Calendar."
                      : "Sync your CDP sessions to Google Calendar and see all your events in one place."}
                  </p>
                </div>
                <GoogleCalendarButton connected={calendarConnected} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function Header({ isParentView, name }: { isParentView: boolean; name: string }) {
  const firstName = name.split(" ")[0]
  return (
    <div>
      <h1 className="font-heading text-3xl font-bold tracking-tight">
        {isParentView ? `${firstName}'s profile` : "Your profile"}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {isParentView
          ? `Keep ${firstName}'s details up to date so their PrepMasters know their goals.`
          : "Keep your details up to date so your PrepMasters know your goals."}
      </p>
    </div>
  )
}
