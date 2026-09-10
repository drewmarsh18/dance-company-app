"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { BrandLogo } from "@/components/brand-logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { LogOut, User, Inbox } from "lucide-react"

const links = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/coaches", label: "PrepMasters" },
  { href: "/dashboard/packages", label: "Packages" },
  { href: "/dashboard/inbox", label: "Inbox" },
]

export function DashboardNav({
  user,
  notificationBell,
}: {
  user: { name: string; email: string; image?: string | null }
  notificationBell?: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  async function handleSignOut() {
    setOpen(false)
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/dashboard" aria-label="College Dance Prep home">
          <BrandLogo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active =
              link.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3">
          {notificationBell}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-full ring-offset-background transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Account menu"
              aria-expanded={open}
            >
              <Avatar className="size-9 cursor-pointer">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback>{initials || "?"}</AvatarFallback>
              </Avatar>
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-popover shadow-md z-50">
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <div className="py-1">
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <User className="size-4 text-muted-foreground" />
                    Profile
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="flex items-center gap-1 border-t px-3 py-2 md:hidden">
        {[...links, { href: "/dashboard/profile", label: "Profile" }].map((link) => {
          const active =
            link.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
