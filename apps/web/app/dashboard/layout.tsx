import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { DashboardNav } from "@/components/dashboard-nav"
import { NotificationBell } from "@/components/notification-bell"
import { ChildSwitcher } from "@/components/child-switcher"
import { Toaster } from "@/components/ui/sonner"
import { getSessionUserWithRole, homePathForRole } from "@/lib/roles"
import { getUnreadCount } from "@/app/actions/notifications"
import { getLinkedChildren, getOrCreateProfile } from "@/app/actions/profile"
import { ShieldCheck, Clock } from "lucide-react"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const t0 = Date.now()
  console.log("[layout] start")
  const user = await getSessionUserWithRole()
  console.log("[layout] got user role=" + user?.role, Date.now() - t0 + "ms")
  if (!user) redirect("/")

  const isAdmin = user.role === "admin"

  if (!isAdmin && user.role !== "dancer") redirect(homePathForRole(user.role))

  const [unreadCount, linkedChildren, profile] = await Promise.all([
    getUnreadCount(user.id),
    isAdmin ? Promise.resolve([]) : getLinkedChildren(),
    isAdmin ? Promise.resolve(null) : getOrCreateProfile({ noCreate: true }),
  ])
  console.log("[layout] got unreadCount", Date.now() - t0 + "ms")
  // Bell only shown to admins — members use the Inbox nav tab instead
  const bell = isAdmin ? <NotificationBell initialCount={unreadCount} /> : undefined
  const activeChildUserId = profile?.effectiveUserId ?? ""
  const activeChild = linkedChildren.find((c) => c.userId === activeChildUserId)

  if (isAdmin) {
    return (
      <div className="min-h-screen">
        <DashboardNav user={{ name: user.name, email: user.email, image: user.image }} notificationBell={bell} />
        <div className="bg-primary/10 border-b border-primary/20 px-5 py-2">
          <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-primary font-medium">
              <ShieldCheck className="size-4" />
              Previewing as Member
            </div>
            <Link href="/admin" className="text-xs text-primary underline underline-offset-2 hover:no-underline">
              Back to Admin
            </Link>
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
        <Toaster position="top-center" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <DashboardNav user={{ name: user.name, email: user.email, image: user.image }} notificationBell={bell} />
      {linkedChildren.length >= 2 && (
        <ChildSwitcher children={linkedChildren} activeChildUserId={activeChildUserId} />
      )}
      {activeChild?.status === "pending" ? (
        <main className="mx-auto max-w-6xl px-5 py-16 flex flex-col items-center text-center gap-4">
          <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-4">
            <Clock className="size-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-semibold">{activeChild.name.split(" ")[0]}&apos;s account is pending approval</h2>
          <p className="max-w-sm text-muted-foreground">
            An admin will review and approve this account shortly. You&apos;ll receive an email at your parent address once it&apos;s approved.
          </p>
        </main>
      ) : activeChild?.status === "denied" ? (
        <main className="mx-auto max-w-6xl px-5 py-16 flex flex-col items-center text-center gap-4">
          <div className="rounded-full bg-destructive/10 p-4">
            <Clock className="size-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">{activeChild.name.split(" ")[0]}&apos;s account was not approved</h2>
          <p className="max-w-sm text-muted-foreground">
            This account request was not approved. If you think this is a mistake, please reach out to us at{" "}
            <a href="mailto:collegedanceprep@gmail.com" className="text-primary underline-offset-2 hover:underline">
              collegedanceprep@gmail.com
            </a>
            .
          </p>
        </main>
      ) : (
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      )}
      <Toaster position="top-center" />
    </div>
  )
}
