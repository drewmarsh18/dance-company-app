import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { appBase, TABLES, type WorkerFields } from "@/lib/airtable"

// PATCH /api/portal/profile — update the Prep Master's own Airtable record
export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  console.log("[portal/profile PATCH] email:", session?.user?.email, "role:", session?.user?.role)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "prep_master" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  console.log("[portal/profile PATCH] body:", JSON.stringify(body))
  const { phone, university, address, region } = body

  const records = await appBase.list<WorkerFields>(TABLES.workers, {
    filterByFormula: `{Email} = '${session.user.email.replace(/'/g, "\\'")}'`,
    maxRecords: 1,
    revalidate: 0,
  })
  console.log("[portal/profile PATCH] worker found:", records.length > 0, records[0]?.id)
  if (!records[0]) return NextResponse.json({ error: "Worker record not found" }, { status: 404 })

  const patch: Partial<WorkerFields> = {}
  if (phone !== undefined) patch.Phone = phone ?? ""
  if (university !== undefined) patch.University = university ?? ""
  if (address !== undefined) patch.Address = address ?? ""
  if (region !== undefined) patch.Region = region ?? ""

  console.log("[portal/profile PATCH] applying patch:", JSON.stringify(patch))
  await appBase.update<WorkerFields>(TABLES.workers, records[0].id, patch)
  console.log("[portal/profile PATCH] update complete")

  revalidateTag(`portal-${session.user.email}`)

  return NextResponse.json({ ok: true })
}
