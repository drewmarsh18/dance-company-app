import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { randomUUID } from "crypto"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { prepMasterAvailability } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { buildWeekTemplate, type DayAvailability } from "@/lib/availability"

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const email = normalizeEmail(session.user.email)
  const rows = await db
    .select()
    .from(prepMasterAvailability)
    .where(eq(prepMasterAvailability.email, email))

  const saved: DayAvailability[] = rows.map((r) => ({
    dayOfWeek: r.dayOfWeek,
    enabled: r.enabled,
    startTime: r.startTime,
    endTime: r.endTime,
  }))

  return NextResponse.json({ week: buildWeekTemplate(saved) })
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { week } = await req.json() as { week: DayAvailability[] }
  const email = normalizeEmail(session.user.email)

  for (const day of week) {
    if (day.enabled && day.endTime <= day.startTime) {
      return NextResponse.json({ ok: false, error: "End time must be after start time for each enabled day." })
    }

    const existing = await db
      .select({ id: prepMasterAvailability.id })
      .from(prepMasterAvailability)
      .where(and(eq(prepMasterAvailability.email, email), eq(prepMasterAvailability.dayOfWeek, day.dayOfWeek)))
      .limit(1)

    if (existing[0]) {
      await db
        .update(prepMasterAvailability)
        .set({ enabled: day.enabled, startTime: day.startTime, endTime: day.endTime, updatedAt: new Date() })
        .where(eq(prepMasterAvailability.id, existing[0].id))
    } else {
      await db.insert(prepMasterAvailability).values({
        id: randomUUID(),
        email,
        dayOfWeek: day.dayOfWeek,
        enabled: day.enabled,
        startTime: day.startTime,
        endTime: day.endTime,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
