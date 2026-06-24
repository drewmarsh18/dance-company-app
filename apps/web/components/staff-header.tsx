"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, LayoutDashboard, Users, ShieldCheck, Check } from "lucide-react"

export function StaffHeader({
  user,
  roleLabel,
  homeHref,
  isAdmin = false,
}: {
  user: { name: string; email: string; image?: string | null }
  roleLabel: string
  homeHref: string
  isAdmin?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function handleSignOut() {
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

  const currentView =
    homeHref === "/admin" ? "admin"
    : homeHref === "/portal" ? "portal"
    : "dashboard"

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-3">
          <Link href={homeHref} aria-label="College Dance Prep home">
            <BrandLogo />
          </Link>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
            {roleLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>

          {/* Avatar — clickable dropdown for admins */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => isAdmin ? setOpen((v) => !v) : undefined}
              className={isAdmin ? "cursor-pointer rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" : ""}
              aria-label="Account menu"
            >
              <Avatar className="size-9">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback>{initials || "?"}</AvatarFallback>
              </Avatar>
            </button>

            {isAdmin && open && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border bg-background shadow-lg">
                <div className="px-3 py-2 border-b">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">View as</p>
                </div>
                <div className="p-1">
                  <ViewOption
                    icon={<ShieldCheck className="size-4" />}
                    label="Admin"
                    description="Full control panel"
                    href="/admin"
                    active={currentView === "admin"}
                    onClick={() => setOpen(false)}
                  />
                  <ViewOption
                    icon={<Users className="size-4" />}
                    label="Member"
                    description="Dancer booking view"
                    href="/dashboard"
                    active={currentView === "dashboard"}
                    onClick={() => setOpen(false)}
                  />
                  <ViewOption
                    icon={<LayoutDashboard className="size-4" />}
                    label="Prep Master"
                    description="Portal & availability"
                    href="/portal"
                    active={currentView === "portal"}
                    onClick={() => setOpen(false)}
                  />
                </div>
                <div className="border-t p-1">
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          {!isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

function ViewOption({
  icon, label, description, href, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  href: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
      }`}
    >
      <span className={active ? "text-primary" : "text-muted-foreground"}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {active && <Check className="size-3.5 shrink-0 text-primary" />}
    </Link>
  )
}
