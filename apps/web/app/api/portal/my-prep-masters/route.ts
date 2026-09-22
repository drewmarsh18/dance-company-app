import { NextRequest, NextResponse } from "next/server"
import { getSessionUserWithRole } from "@/lib/roles"
import {
  getPrepMasterByEmail,
  getTeamForRD,
  getMonthBookingsForTeam,
  isAirtableConfigured,
} from "@/lib/airtable"

export async function GET(req: NextRequest) {
  const user = await getSessionUserWithRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isAirtableConfigured()) {
    return NextResponse.json({ error: "Airtable not configured" }, { status: 503 })
  }

  const isAdmin = user.role === "admin"
  const worker = await getPrepMasterByEmail(user.email)
  const isRD = worker?.workerRole === "Regional Director"

  if (!isAdmin && !isRD) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year  = parseInt(searchParams.get("year")  ?? String(now.getFullYear()), 10)
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1), 10)

  // Admins can pass any rdName; RDs can only see their own team
  let rdName: string
  if (isAdmin) {
    rdName = searchParams.get("rdName") ?? ""
    if (!rdName) return NextResponse.json({ error: "rdName required for admin" }, { status: 400 })
  } else {
    rdName = worker!.name
  }

  const team = await getTeamForRD(rdName)
  const summaries = await getMonthBookingsForTeam(team.map((pm) => pm.name), year, month)

  const pmMap = new Map(team.map((pm) => [pm.name, pm]))
  const result = summaries.map((s) => ({
    pm: pmMap.get(s.pm.name) ?? s.pm,
    bookings: s.bookings,
  }))

  return NextResponse.json({ team: result, rdName, year, month })
}
