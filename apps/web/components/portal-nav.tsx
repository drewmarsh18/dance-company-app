"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { CalendarDays, Clock, CalendarPlus, Inbox, UserCircle, BookOpen } from "lucide-react"

const LINKS = [
  { href: "/portal", label: "Schedule", icon: CalendarDays },
  { href: "/portal/book", label: "Book session", icon: CalendarPlus },
  { href: "/portal/availability", label: "Availability", icon: Clock },
  { href: "/portal/inbox", label: "Inbox", icon: Inbox },
  { href: "/portal/profile", label: "Profile", icon: UserCircle },
  { href: "/portal/onboarding", label: "Onboarding", icon: BookOpen },
]

export function PortalNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-0.5 border-b overflow-x-auto scrollbar-none">
      {LINKS.map((link) => {
        const active = pathname === link.href
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-xs font-medium transition-colors whitespace-nowrap sm:px-3 sm:text-sm sm:gap-2",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-4 shrink-0" />
            <span className="hidden xs:inline">{link.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
