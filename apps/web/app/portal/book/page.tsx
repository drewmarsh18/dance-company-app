import { redirect } from "next/navigation"
import { getPrepMasterByEmail, isAirtableConfigured } from "@/lib/airtable"
import { getSessionUserWithRole } from "@/lib/roles"
import { getMyAvailability } from "@/app/actions/availability"
import { getPastClients } from "@/app/actions/portal-booking"
import { PortalBookForm } from "@/components/portal-book-form"
import { AirtableSetupNotice } from "@/components/airtable-setup-notice"

export default async function PortalBookPage() {
  const user = await getSessionUserWithRole()
  if (!user) redirect("/")

  if (!isAirtableConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Book a session</h1>
        <AirtableSetupNotice />
      </div>
    )
  }

  const prepMaster = user ? await getPrepMasterByEmail(user.email) : null
  if (!prepMaster) redirect("/portal")

  const [clients, availability] = await Promise.all([
    getPastClients(),
    getMyAvailability(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Book a session</h1>
        <p className="mt-1 text-muted-foreground">
          Schedule a new session with a member you&apos;ve previously worked with.
        </p>
      </div>
      <div className="max-w-lg">
        <PortalBookForm clients={clients} availability={availability} />
      </div>
    </div>
  )
}
