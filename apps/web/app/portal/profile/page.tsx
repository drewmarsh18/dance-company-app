import { getSessionUserWithRole } from "@/lib/roles"
import { isCalendarConnected } from "@/lib/google-calendar"
import { getPrepMasterByEmail } from "@/lib/airtable"
import { PortalProfileForm } from "@/components/portal-profile-form"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { db } from "@/lib/db"
import { account } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

export default async function PortalProfilePage() {
  const user = await getSessionUserWithRole()
  if (!user) return null

  let phone = ""
  let address = ""
  let university = ""
  let calendarConnected = false
  let error: string | null = null

  try {
    const [pm, cal] = await Promise.all([
      getPrepMasterByEmail(user.email),
      isCalendarConnected(user.id),
    ])
    phone = pm?.phone ?? ""
    address = pm?.address ?? ""
    university = pm?.university ?? ""
    calendarConnected = cal
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load your profile."
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="mt-1 text-muted-foreground">
          Update your details, connect accounts, and manage your session.
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 py-5 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <PortalProfileForm
          initialPhone={phone}
          initialAddress={address}
          initialUniversity={university}
          calendarConnected={calendarConnected}
          isGoogleLinked={await db.select({ id: account.id }).from(account).where(and(eq(account.userId, user.id), eq(account.providerId, "google"))).limit(1).then((rows) => rows.length > 0)}
        />
      )}
    </div>
  )
}
