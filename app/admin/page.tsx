import { listInvites } from "@/app/actions/invites"
import { getAdminData } from "@/app/actions/admin"
import { AdminTabs } from "@/components/admin-tabs"

export default async function AdminPage() {
  const [invites, { members, bookings, workers, plans, packages }] = await Promise.all([
    listInvites(),
    getAdminData(),
  ])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Admin</h1>
        <p className="mt-1 text-muted-foreground">
          Manage invites, member accounts, and Prep Master payroll.
        </p>
      </div>
      <AdminTabs
        invites={invites}
        members={members}
        bookings={bookings}
        workers={workers}
        plans={plans}
        packages={packages}
      />
    </div>
  )
}
