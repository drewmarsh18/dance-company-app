import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { isAdminEmail } from "@/lib/roles"
import { adminUpdateWorker, adminDeleteWorker } from "@/lib/airtable"
import { db } from "@/lib/db"
import { prepMasterInvite, user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  await adminUpdateWorker(id, body)
  revalidateTag("admin")
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { email } = await req.json()

  await adminDeleteWorker(id)
  if (email) {
    const users = await db.select().from(userTable).where(eq(userTable.email, email))
    if (users[0]) await db.delete(userTable).where(eq(userTable.id, users[0].id))
    await db.delete(prepMasterInvite).where(eq(prepMasterInvite.email, email))
  }
  revalidateTag("admin")
  return NextResponse.json({ ok: true })
}
