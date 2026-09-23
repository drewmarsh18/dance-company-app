"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const links = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/coaches", label: "PrepMasters" },
  { href: "/dashboard/packages", label: "Packages" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/profile", label: "Profile" },
]

export function DashboardTabNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-0.5 border-b overflow-x-auto scrollbar-none">
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
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
