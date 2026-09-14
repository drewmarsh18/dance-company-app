"use client"

import { Clock } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"

export default function PendingPage() {
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Pending Approval</h1>
          <p className="text-muted-foreground">
            Your account is under review. An admin will approve your account shortly.
            You'll receive a notification once you're approved.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Questions? Email us at{" "}
          <a href="mailto:collegedanceprep@gmail.com" className="text-primary underline">
            collegedanceprep@gmail.com
          </a>
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sm text-muted-foreground underline"
        >
          Back to CDP
        </button>
      </div>
    </main>
  )
}
