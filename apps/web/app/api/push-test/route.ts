import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { pushToken } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { sendPushToUser } from "@/lib/push"

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tokens = await db
    .select({ token: pushToken.token })
    .from(pushToken)
    .where(eq(pushToken.userId, session.user.id))

  if (tokens.length === 0) {
    return NextResponse.json({ ok: false, error: "No push token registered for this user. Make sure you have opened the app and granted notification permission." })
  }

  await sendPushToUser(session.user.id, {
    title: "Test notification 🎉",
    body: "Push notifications are working correctly.",
    data: { type: "test" },
  })

  return NextResponse.json({ ok: true, tokenCount: tokens.length })
}

// GET — just check if tokens exist
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tokens = await db
    .select({ token: pushToken.token })
    .from(pushToken)
    .where(eq(pushToken.userId, session.user.id))

  return NextResponse.json({ tokenCount: tokens.length, hasToken: tokens.length > 0 })
}
