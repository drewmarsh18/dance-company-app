import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { StaffHeader } from "@/components/staff-header"
import { PortalNav } from "@/components/portal-nav"
import { NotificationBell } from "@/components/notification-bell"
import { Toaster } from "@/components/ui/sonner"
import {
  getSessionUserWithRole,
  homePathForRole,
  markInviteAccepted,
} from "@/lib/roles"
import { getUnreadCount } from "@/app/actions/notifications"
import { ShieldCheck } from "lucide-react"

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUserWithRole()
  if (!user) redirect("/")

  const isAdmin = user.role === "admin"

  if (!isAdmin && user.role !== "prep_master") redirect(homePathForRole(user.role))

  if (user.role === "prep_master") {
    await markInviteAccepted(user.email)
  }

  const unreadCount = await getUnreadCount(user.id)

  return (
    <div className="min-h-screen">
      <StaffHeader
        user={{ name: user.name, email: user.email, image: user.image }}
        roleLabel={isAdmin ? "Admin" : "PrepMaster"}
        homeHref="/portal"
        isAdmin={isAdmin}
        notificationBell={<NotificationBell initialCount={unreadCount} />}
      />
      {isAdmin && (
        <div className="bg-primary/10 border-b border-primary/20 px-5 py-2">
          <div className="mx-auto max-w-5xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-primary font-medium">
              <ShieldCheck className="size-4" />
              Previewing as PrepMaster
            </div>
            <Link href="/admin" className="text-xs text-primary underline underline-offset-2 hover:no-underline">
              Back to Admin
            </Link>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-5xl px-5 pt-4">
        <PortalNav />
      </div>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      <Toaster position="top-center" />
    </div>
  )
}
