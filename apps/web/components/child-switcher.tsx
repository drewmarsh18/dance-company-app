"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Users, Clock } from "lucide-react"

export function ChildSwitcher({
  children,
  activeChildUserId,
}: {
  children: { userId: string; name: string; status: string }[]
  activeChildUserId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (children.length < 2) return null

  async function switchTo(userId: string) {
    if (userId === activeChildUserId || loading) return
    setLoading(true)
    await fetch("/api/parent/select-child", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childUserId: userId }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="border-b bg-secondary/40 px-5 py-2">
      <div className="mx-auto max-w-6xl flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Users className="size-3.5" />
          Viewing:
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {children.map((child) => {
            const active = child.userId === activeChildUserId
            const pending = child.status === "pending"
            const denied = child.status === "denied"
            return (
              <button
                key={child.userId}
                onClick={() => switchTo(child.userId)}
                disabled={loading}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? denied
                      ? "bg-destructive/10 text-destructive border border-destructive/30"
                      : pending
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-300 dark:border-amber-700"
                        : "bg-primary text-primary-foreground"
                    : "bg-background border text-foreground hover:bg-muted"
                }`}
              >
                {(pending || denied) && <Clock className="size-3" />}
                {child.name.split(" ")[0]}
                {pending && <span className="opacity-70">·&nbsp;Pending</span>}
                {denied && <span className="opacity-70">·&nbsp;Denied</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
