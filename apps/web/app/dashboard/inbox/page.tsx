import { getMyNotifications } from "@/app/actions/notifications"
import { NotificationsInbox } from "@/components/notifications-inbox"

export default async function MemberInboxPage() {
  const notifications = await getMyNotifications()
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Inbox</h1>
        <p className="mt-1 text-muted-foreground">
          Booking confirmations, reschedule requests, and other updates.
        </p>
      </div>
      <NotificationsInbox initialNotifications={notifications} />
    </div>
  )
}
