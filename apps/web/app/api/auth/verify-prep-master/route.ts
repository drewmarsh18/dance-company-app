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

  const email = session.user.email.trim().toLowerCase()

  // If the caller already has an accepted invite, they're already a PM — no re-grant needed
  const existing = await db
    .select({ id: prepMasterInvite.id, status: prepMasterInvite.status })
    .from(prepMasterInvite)
    .where(eq(prepMasterInvite.email, email))
    .limit(1)
  if (existing[0]?.status === "accepted") {
    return NextResponse.json({ verified: true, prepMasterName: existing[0] ? name.trim() : "" })
  }

  const prepMasters = await getPrepMasters()
  // Match on name + university AND require the Airtable record's email matches the caller's email
  // This prevents someone from stealing another PM's identity via self-verification
  const match = prepMasters.find(
    (pm) =>
      normalize(pm.name) === normalize(name) &&
      normalize(pm.university) === normalize(university) &&
      pm.email.trim().toLowerCase() === email,
  )

  if (!match) {
    return NextResponse.json({ verified: false })
  }

  // Grant prep master access
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
