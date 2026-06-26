"use server"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { notification } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { getSessionUserWithRole } from "@/lib/roles"
import { sendPushToUser } from "@/lib/push"

export type AppNotification = {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  bookingId: string | null
  createdAt: Date
}

/** Fetch the latest 30 notifications for the current user. */
export async function getMyNotifications(): Promise<AppNotification[]> {
  const user = await getSessionUserWithRole()
  if (!user) return []
  const rows = await db
    .select()
    .from(notification)
    .where(eq(notification.userId, user.id))
    .orderBy(desc(notification.createdAt))
    .limit(30)
  return rows
}

/** Count unread notifications for the current user. */
export async function getUnreadCount(userId?: string): Promise<number> {
  try {
    const uid = userId ?? (await getSessionUserWithRole())?.id
    if (!uid) return 0
    const rows = await db
      .select({ id: notification.id })
      .from(notification)
      .where(and(eq(notification.userId, uid), eq(notification.read, false)))
    return rows.length
  } catch {
    return 0
  }
}

/** Mark a single notification as read. */
export async function markNotificationRead(id: string): Promise<void> {
  const user = await getSessionUserWithRole()
  if (!user) return
  await db
    .update(notification)
    .set({ read: true })
    .where(and(eq(notification.id, id), eq(notification.userId, user.id)))
}

/** Mark all notifications as read for the current user. */
export async function markAllRead(): Promise<void> {
  const user = await getSessionUserWithRole()
  if (!user) return
  await db
    .update(notification)
    .set({ read: true })
    .where(and(eq(notification.userId, user.id), eq(notification.read, false)))
}

/** Internal helper — called from booking server actions to create a notification. */
export async function createNotification({
  userId,
  type,
  title,
  body,
  bookingId,
  pushCategory,
  pushData,
}: {
  userId: string
  type: string
  title: string
  body: string
  bookingId?: string
  pushCategory?: string
  pushData?: Record<string, unknown>
}): Promise<void> {
  await db.insert(notification).values({
    id: randomUUID(),
    userId,
    type,
    title,
    body,
    bookingId: bookingId ?? null,
    read: false,
  })

  // Fire push — never block the caller
  sendPushToUser(userId, {
    title,
    body,
    categoryIdentifier: pushCategory,
    data: { bookingId: bookingId ?? null, type, ...(pushData ?? {}) },
  }).catch(() => {})
}
