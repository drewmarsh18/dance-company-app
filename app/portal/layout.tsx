import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { StaffHeader } from "@/components/staff-header"
import { PortalNav } from "@/components/portal-nav"
import { Toaster } from "@/components/ui/sonner"
import {
  getSessionUserWithRole,
  homePathForRole,
  markInviteAccepted,
} from "@/lib/roles"

export default async function PortalLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getSessionUserWithRole()
  if (!user) redirect("/")
  if (user.role !== "prep_master") redirect(homePathForRole(user.role))

  // Record that the invited prep master has signed in.
  await markInviteAccepted(user.email)

  return (
    <div className="min-h-screen">
      <StaffHeader
        user={{ name: user.name, email: user.email, image: user.image }}
        roleLabel="Prep Master"
        homeHref="/portal"
      />
      <div className="mx-auto max-w-5xl px-5 pt-4">
        <PortalNav />
      </div>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      <Toaster position="top-center" />
    </div>
  )
}
