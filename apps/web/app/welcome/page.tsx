import Link from "next/link"
import { CheckCircle, Smartphone } from "lucide-react"

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams
  const isPrep = role === "prep"

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center px-4">
      <div className="flex size-20 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle className="size-10 text-primary" />
      </div>

      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          {isPrep ? "Account created!" : "You're connected."}
        </h1>
        <p className="mt-2 text-muted-foreground max-w-sm">
          {isPrep
            ? "Download the College Dance Prep app to manage your sessions and availability."
            : "Your account is now linked to your child's sessions and credits."}
        </p>
      </div>

      <a
        href={isPrep ? "cdp://" : "cdp://member/plans"}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
      >
        <Smartphone className="size-5" />
        {isPrep ? "Open PrepMaster App" : "Open CDP Booking App"}
      </a>

      <Link
        href={isPrep ? "/portal" : "/dashboard"}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Continue on web
      </Link>
    </div>
  )
}
