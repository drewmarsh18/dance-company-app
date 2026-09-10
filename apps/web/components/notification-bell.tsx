"use client"

import { useState, useRef, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bell, CalendarDays, CalendarX, CalendarClock, CheckCheck } from "lucide-react"
import { getMyNotifications, markNotificationRead, markAllRead, type AppNotification } from "@/app/actions/notifications"

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function NotifIcon({ type }: { type: string }) {
  if (type === "booking_confirmed") return <CalendarDays className="size-4 text-green-600 shrink-0" />
  if (type === "booking_cancelled") return <CalendarX className="size-4 text-red-500 shrink-0" />
  return <CalendarClock className="size-4 text-primary shrink-0" />
}

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(initialCount)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Re-sync when inbox marks things as read externally
  useEffect(() => {
    function handleExternalRead() {
      startTransition(async () => {
        const notifs = await getMyNotifications()
        setNotifications(notifs)
        setLoaded(true)
        setUnread(notifs.filter((n) => !n.read).length)
      })
    }
    window.addEventListener("notifications-updated", handleExternalRead)
    return () => window.removeEventListener("notifications-updated", handleExternalRead)
  }, [])

  function handleOpen() {
    if (!open && !loaded) {
      startTransition(async () => {
        const notifs = await getMyNotifications()
        setNotifications(notifs)
        setUnread(notifs.filter((n) => !n.read).length)
        setLoaded(true)
      })
    }
    setOpen((v) => !v)
  }

  async function handleMarkRead(id: string) {
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    setUnread((v) => Math.max(0, v - 1))
  }

  async function handleNotificationClick(n: AppNotification) {
    setOpen(false)
    if (!n.read) {
      markNotificationRead(n.id).catch(() => {})
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))
      setUnread((v) => Math.max(0, v - 1))
    }
    router.push(n.link)
  }

  async function handleMarkAll() {
    await markAllRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center rounded-full p-1.5 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-background shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y">
            {!loaded ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${n.read ? "opacity-60" : ""}`}
                >
                  <div className="mt-0.5">
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 size-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
