"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CalendarCheck, CalendarX } from "lucide-react"
import { toast } from "sonner"

export function GoogleCalendarButton({ connected }: { connected: boolean }) {
  const [isConnected, setIsConnected] = useState(connected)
  const [loading, setLoading] = useState(false)

  async function handleDisconnect() {
    setLoading(true)
    const res = await fetch("/api/google-calendar", { method: "DELETE" })
    if (res.ok) {
      setIsConnected(false)
      toast.success("Google Calendar disconnected.")
    } else {
      toast.error("Failed to disconnect. Please try again.")
    }
    setLoading(false)
  }

  if (isConnected) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleDisconnect}
        disabled={loading}
        className="gap-2 border-green-300 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
      >
        <CalendarCheck className="size-4" />
        {loading ? "Disconnecting…" : "Google Calendar connected"}
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className="gap-2"
    >
      <a href="/api/google-calendar">
        <CalendarX className="size-4" />
        Connect Google Calendar
      </a>
    </Button>
  )
}
