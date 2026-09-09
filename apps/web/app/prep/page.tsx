import { redirect } from "next/navigation"
import { BrandLogo } from "@/components/brand-logo"
import { PrepMasterSignUpForm } from "@/components/prep-master-sign-up-form"
import { getSessionUserWithRole, homePathForRole } from "@/lib/roles"
import { db } from "@/lib/db"
import { prepMasterInvite } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export default async function PrepPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; name?: string }>
}) {
  const user = await getSessionUserWithRole()
  if (user) redirect(homePathForRole(user.role))

  const { email = "", name = "" } = await searchParams

  // Validate the invite exists
  let inviteValid = false
  if (email) {
    const normalized = email.trim().toLowerCase()
    const invite = await db
      .select({ status: prepMasterInvite.status })
      .from(prepMasterInvite)
      .where(eq(prepMasterInvite.email, normalized))
      .limit(1)
    inviteValid = invite[0]?.status === "pending"
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          {!inviteValid ? (
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Invalid invite</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This invite link is invalid or has already been used. Contact your admin for a new link.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Welcome, {name || "PrepMaster"}!
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a password for <strong>{email}</strong> to set up your PrepMaster account.
                </p>
              </div>
              <PrepMasterSignUpForm email={email} name={name} />
            </>
          )}
        </div>
      </div>
    </main>
  )
}
