import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { randomUUID } from "crypto"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { pushToken } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { token } = await req.json()
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token required" }, { status: 400 })
  }

  // Upsert — if this token already exists for this user, leave it; if it's a
  // new device token, insert it. If the token belongs to another user (device
  // handed off), update the userId.
  const existing = await db
    .select({ id: pushToken.id, userId: pushToken.userId })
    .from(pushToken)
    .where(eq(pushToken.token, token))
    .limit(1)

  if (existing[0]) {
    if (existing[0].userId !== session.user.id) {
      await db
        .update(pushToken)
        .set({ userId: session.user.id, updatedAt: new Date() })
        .where(eq(pushToken.id, existing[0].id))
    }
  } else {
    await db.insert(pushToken).values({
      id: randomUUID(),
      userId: session.user.id,
      token,
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { token } = await req.json()
  if (token) {
    await db
      .delete(pushToken)
      .where(and(eq(pushToken.token, token), eq(pushToken.userId, session.user.id)))
  }

  return NextResponse.json({ ok: true })
}
