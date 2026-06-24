import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"
import { Toaster } from "@/components/ui/sonner"
import { getSessionUserWithRole, homePathForRole } from "@/lib/roles"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getSessionUserWithRole()
  if (!user) redirect("/")
  // Only dancers belong here; send staff/admins to their own area.
  if (user.role !== "dancer") redirect(homePathForRole(user.role))

  return (
    <div className="min-h-screen">
      <DashboardNav
        user={{
          name: user.name,
          email: user.email,
          image: user.image,
        }}
      />
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      <Toaster position="top-center" />
    </div>
  )
}
