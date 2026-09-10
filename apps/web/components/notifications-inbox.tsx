"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDays, CalendarX, CalendarClock, Package, ShieldCheck, Info,
  CheckCheck, Mail, MailOpen,
} from "lucide-react"
import { markNotificationRead, markAllRead, type AppNotification } from "@/app/actions/notifications"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Filter = "all" | "unread"

function typeIcon(type: string) {
  if (type === "booking_confirmed") return <CalendarDays className="size-4 text-green-600 shrink-0" />
  if (type === "booking_cancelled") return <CalendarX className="size-4 text-red-500 shrink-0" />
  if (type === "booking_updated") return <CalendarClock className="size-4 text-primary shrink-0" />
  if (type.startsWith("booking")) return <CalendarClock className="size-4 text-primary shrink-0" />
  if (type.startsWith("account")) return <ShieldCheck className="size-4 text-primary shrink-0" />
  if (type.startsWith("plan") || type.startsWith("credit")) return <Package className="size-4 text-primary shrink-0" />
  return <Info className="size-4 text-muted-foreground shrink-0" />
}

function timeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function NotificationsInbox({ initialNotifications }: { initialNotifications: AppNotification[] }) {
  const router = useRouter()
  const [notifications, setNotifications] = useState(initialNotifications)
  const [filter, setFilter] = useState<Filter>("all")
  const [, startTransition] = useTransition()

  const unreadCount = notifications.filter((n) => !n.read).length
  const displayed = filter === "unread" ? notifications.filter((n) => !n.read) : notifications

  function notify() {
    window.dispatchEvent(new Event("notifications-updated"))
  }

  function handleMarkRead(n: AppNotification) {
    if (!n.read) {
      startTransition(async () => {
        await markNotificationRead(n.id)
        setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))
        notify()
      })
    }
    router.push(n.link)
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      notify()
    })
  }

  function handleToggleRead(n: AppNotification, e: React.MouseEvent) {
    e.stopPropagation()
    startTransition(async () => {
      await markNotificationRead(n.id)
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: !x.read } : x))
      notify()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter + mark-all */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
          {(["all", "unread"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>
              {f}
              {f === "unread" && unreadCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="gap-2 text-muted-foreground">
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <MailOpen className="size-10 text-muted-foreground" />
            <p className="font-medium">
              {filter === "unread" ? "You're all caught up" : "No notifications yet"}
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              {filter === "unread"
                ? "No unread notifications."
                : "Booking confirmations, reschedule requests, and other updates will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border overflow-hidden">
          {displayed.map((n) => (
            <div key={n.id}
              onClick={() => handleMarkRead(n)}
              className={cn(
                "flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-muted/50 group",
                !n.read && "bg-primary/5"
              )}>
              {/* Icon */}
              <div className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                n.type === "booking_confirmed" ? "bg-green-100 dark:bg-green-900/30" :
                n.type === "booking_cancelled" ? "bg-red-100 dark:bg-red-900/30" : "bg-primary/10"
              )}>
                {typeIcon(n.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm leading-snug", !n.read ? "font-semibold" : "font-medium text-muted-foreground")}>
                  {n.title}
                </p>
                <p className={cn("text-sm mt-0.5 leading-snug", !n.read ? "text-foreground" : "text-muted-foreground")}>
                  {n.body}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
              </div>

              {/* Unread dot + toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => handleToggleRead(n, e)}
                  title={n.read ? "Mark unread" : "Mark read"}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                >
                  {n.read
                    ? <Mail className="size-3.5 text-muted-foreground" />
                    : <MailOpen className="size-3.5 text-muted-foreground" />
                  }
                </button>
                {!n.read && <div className="size-2 rounded-full bg-primary shrink-0" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
