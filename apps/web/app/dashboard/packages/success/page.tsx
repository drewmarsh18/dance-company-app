import Link from "next/link"
import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PurchaseSuccessPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center px-4">
      <div className="flex size-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <CheckCircle className="size-10 text-green-600 dark:text-green-400" />
      </div>
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Purchase complete!</h1>
        <p className="mt-2 text-muted-foreground max-w-sm">
          Your credits have been added to your account. You're ready to book your sessions.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/dashboard">Book a session</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/packages">View packages</Link>
        </Button>
      </div>
    </div>
  )
}
