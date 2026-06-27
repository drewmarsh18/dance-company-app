import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { randomUUID } from "crypto"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { prepMasterInvite } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getPrepMasters } from "@/lib/airtable"

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, university } = await req.json() as { name?: string; university?: string }
  if (!name?.trim() || !university?.trim()) {
    return NextResponse.json({ verified: false, error: "Name and university are required." })
  }

  const prepMasters = await getPrepMasters()
  const match = prepMasters.find(
    (pm) =>
      normalize(pm.name) === normalize(name) &&
      normalize(pm.university) === normalize(university),
  )

  if (!match) {
    return NextResponse.json({ verified: false })
  }

  // Grant prep master access by upserting into the invite table
  const email = session.user.email.trim().toLowerCase()
  const existing = await db
    .select({ id: prepMasterInvite.id })
    .from(prepMasterInvite)
    .where(eq(prepMasterInvite.email, email))
    .limit(1)

  if (!existing[0]) {
    await db.insert(prepMasterInvite).values({
      id: randomUUID(),
      email,
      name: match.name,
      invitedBy: "self-verified",
      status: "accepted",
      acceptedAt: new Date(),
    })
  } else {
    await db
      .update(prepMasterInvite)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(prepMasterInvite.email, email))
  }

  return NextResponse.json({ verified: true, prepMasterName: match.name })
}
