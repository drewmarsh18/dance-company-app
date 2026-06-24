import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { DashboardNav } from "@/components/dashboard-nav"
import { Toaster } from "@/components/ui/sonner"
import { getSessionUserWithRole, homePathForRole } from "@/lib/roles"
import { ShieldCheck } from "lucide-react"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUserWithRole()
  if (!user) redirect("/")

  const isAdmin = user.role === "admin"

  // Non-admin staff go to their own area; admins are allowed through for preview
  if (!isAdmin && user.role !== "dancer") redirect(homePathForRole(user.role))

  if (isAdmin) {
    return (
      <div className="min-h-screen">
        <DashboardNav user={{ name: user.name, email: user.email, image: user.image }} />
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
      <DashboardNav user={{ name: user.name, email: user.email, image: user.image }} />
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      <Toaster position="top-center" />
    </div>
  )
}
