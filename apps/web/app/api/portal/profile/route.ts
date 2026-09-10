import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { resolveRole } from "@/lib/roles"
import { appBase, TABLES, type WorkerFields } from "@/lib/airtable"

// PATCH /api/portal/profile — update the Prep Master's own Airtable record
export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = await resolveRole(session.user.email)
  if (role !== "prep_master" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { phone, university, address, region } = await req.json()

  const records = await appBase.list<WorkerFields>(TABLES.workers, {
    filterByFormula: `{Email} = '${session.user.email.replace(/'/g, "\\'")}'`,
    maxRecords: 1,
    revalidate: 0,
  })
  if (!records[0]) return NextResponse.json({ error: "Worker record not found" }, { status: 404 })

  const patch: Partial<WorkerFields> = {}
  if (phone !== undefined) patch.Phone = phone ?? ""
  if (university !== undefined) patch.University = university ?? ""
  if (address !== undefined) patch.Address = address ?? ""
  if (region !== undefined) patch.Region = region ?? ""

  await appBase.update<WorkerFields>(TABLES.workers, records[0].id, patch)

  revalidateTag(`portal-${session.user.email}`)

  return NextResponse.json({ ok: true })
}
