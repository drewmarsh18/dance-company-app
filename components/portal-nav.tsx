"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { CalendarDays, Clock } from "lucide-react"

const LINKS = [
  { href: "/portal", label: "Schedule", icon: CalendarDays },
  { href: "/portal/availability", label: "Availability", icon: Clock },
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
