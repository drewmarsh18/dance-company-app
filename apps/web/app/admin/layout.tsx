import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { StaffHeader } from "@/components/staff-header"
import { NotificationBell } from "@/components/notification-bell"
import { Toaster } from "@/components/ui/sonner"
import { getSessionUserWithRole, homePathForRole } from "@/lib/roles"
import { getUnreadCount } from "@/app/actions/notifications"

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getSessionUserWithRole()
  if (!user) redirect("/")
  if (user.role !== "admin") redirect(homePathForRole(user.role))

  const unreadCount = await getUnreadCount(user.id)

  return (
    <div className="min-h-screen">
      <StaffHeader
        user={{ name: user.name, email: user.email, image: user.image }}
        roleLabel="Admin"
        homeHref="/admin"
        isAdmin
        notificationBell={<NotificationBell initialCount={unreadCount} />}
      />
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      <Toaster position="top-center" />
    </div>
  )
}
