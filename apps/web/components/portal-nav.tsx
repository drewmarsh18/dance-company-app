"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { CalendarDays, Clock, CalendarPlus, Inbox, UserCircle } from "lucide-react"

const LINKS = [
  { href: "/portal", label: "Schedule", icon: CalendarDays },
  { href: "/portal/book", label: "Book session", icon: CalendarPlus },
  { href: "/portal/availability", label: "Availability", icon: Clock },
  { href: "/portal/inbox", label: "Inbox", icon: Inbox },
  { href: "/portal/profile", label: "Profile", icon: UserCircle },
]

export function PortalNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 border-b">
      {LINKS.map((link) => {
        const active = pathname === link.href
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-4" />
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
