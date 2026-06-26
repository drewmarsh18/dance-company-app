"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatPrice, type PerPrivate } from "@/lib/packages"
import { Clock } from "lucide-react"
import { useState } from "react"
import { createCheckoutSession } from "@/app/actions/checkout"

export function PerPrivateCard({ session }: { session: PerPrivate }) {
  const [loading, setLoading] = useState(false)

  async function handlePurchase() {
    setLoading(true)
    await createCheckoutSession(session.id)
    setLoading(false)
  }

  return (
    <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <Clock className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-heading text-lg font-bold leading-none">
            {session.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.minutes}-minute private session
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-4 sm:w-auto">
        <span className="font-heading text-2xl font-bold tracking-tight">
          {formatPrice(session.price)}
        </span>
        <Button variant="outline" onClick={handlePurchase} disabled={loading}>
          {loading ? "Redirecting…" : "Book single"}
        </Button>
      </div>
    </Card>
  )
}
