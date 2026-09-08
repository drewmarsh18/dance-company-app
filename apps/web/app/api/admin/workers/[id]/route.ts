import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { isAdminEmail } from "@/lib/roles"
import { adminUpdateWorker } from "@/lib/airtable"

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
