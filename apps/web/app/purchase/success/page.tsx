"use client"

import Link from "next/link"
import { CheckCircle, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PurchaseSuccessPage() {
  function openApp() {
    // Try to open the native app via custom scheme. After a short delay,
    // if the app didn't open (user doesn't have it installed), do nothing.
    window.location.href = "cdp://member/plans"
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center px-4">
      <div className="flex size-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <CheckCircle className="size-10 text-green-600 dark:text-green-400" />
      </div>

      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Purchase complete!</h1>
        <p className="mt-2 text-muted-foreground max-w-sm">
          Your session credits have been added to your account. Head back to the College Dance Prep app to book your sessions.
        </p>
      </div>

      {/* Primary CTA — open the app */}
      <button
        onClick={openApp}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
      >
        <Smartphone className="size-5" />
        Open CDP Booking App
      </button>

      <p className="text-sm text-muted-foreground">
        Don&apos;t have the app?{" "}
        <Link href="/dashboard" className="underline underline-offset-2 hover:text-foreground transition-colors">
          Continue on the web
        </Link>
      </p>
    </div>
  )
}
