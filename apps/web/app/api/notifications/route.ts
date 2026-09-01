import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notification } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { randomUUID } from "crypto"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await db
    .select()
    .from(notification)
    .where(eq(notification.userId, session.user.id))
    .orderBy(desc(notification.createdAt))
    .limit(50)

  return NextResponse.json({ notifications: rows })
}

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json() as { id?: string }

  if (id) {
    await db
      .update(notification)
      .set({ read: true })
      .where(and(eq(notification.id, id), eq(notification.userId, session.user.id)))
  } else {
    // Mark all read
    await db
      .update(notification)
      .set({ read: true })
      .where(and(eq(notification.userId, session.user.id), eq(notification.read, false)))
  }

  return NextResponse.json({ ok: true })
}
