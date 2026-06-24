import Link from "next/link"
import type { PrepMaster } from "@/lib/airtable"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, MapPin } from "lucide-react"

export function CoachCard({ coach }: { coach: PrepMaster }) {
  const initials = coach.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <Card className="flex flex-row items-center gap-3 p-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent font-heading text-sm font-semibold text-primary">
        {initials}
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-heading text-sm font-semibold tracking-tight">
          {coach.name}
        </h3>
        {coach.region ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{coach.region}</span>
          </p>
        ) : null}
      </div>

      <Button asChild size="sm" variant="secondary" className="shrink-0">
        <Link href={`/book/${coach.id}`} aria-label={`Book with ${coach.name}`}>
          Book
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </Card>
  )
}
