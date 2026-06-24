"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice, type DancePackage } from "@/lib/packages"
import { Check } from "lucide-react"
import { toast } from "sonner"

export function PackageCard({ pkg }: { pkg: DancePackage }) {
  function handlePurchase() {
    toast.info("Payments not enabled yet", {
      description:
        "Connect Stripe to enable secure checkout for this package.",
    })
  }

  return (
    <Card
      className={
        pkg.highlight
          ? "relative flex flex-col border-primary p-6 shadow-lg ring-1 ring-primary"
          : "relative flex flex-col p-6"
      }
    >
      {pkg.highlight ? (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
          Most popular
        </Badge>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-xl font-bold">{pkg.name}</h2>
        <Badge variant="secondary" className="shrink-0">
          Save {formatPrice(pkg.savings)}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">Hourly privates</p>

      <div className="mt-4 flex items-end gap-1">
        <span className="font-heading text-4xl font-bold tracking-tight">
          {formatPrice(pkg.price)}
        </span>
        <span className="mb-1 text-sm text-muted-foreground">
          / {pkg.sessions} hours
        </span>
      </div>
      <p className="mt-1 text-sm font-medium text-primary">
        {formatPrice(pkg.perSession)} per session
      </p>

      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {pkg.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="leading-relaxed">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        onClick={handlePurchase}
        variant={pkg.highlight ? "default" : "outline"}
        className="mt-6 w-full"
      >
        Get {pkg.name}
      </Button>
    </Card>
  )
}
