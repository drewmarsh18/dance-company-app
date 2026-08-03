"use server"

import { randomUUID } from "crypto"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { prepMasterAvailability } from "@/lib/db/schema"
import { buildWeekTemplate, type DayAvailability } from "@/lib/availability"

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

/** Reads saved availability windows for an email (lower-level helper). */
export async function getAvailabilityForEmail(
  email: string,
): Promise<DayAvailability[]> {
  const rows = await db
    .select()
    .from(prepMasterAvailability)
    .where(eq(prepMasterAvailability.email, normalizeEmail(email)))
  // normalizeEmail keeps reads consistent with the lowercased rows we write.
  return rows.map((r) => ({
    dayOfWeek: r.dayOfWeek,
    enabled: r.enabled,
    startTime: r.startTime,
    endTime: r.endTime,
  }))
}

/** Returns the logged-in prep master's full 7-day availability template.
 *  Seeds 6 AM – 11 PM Mon–Sun on first use if no rows exist yet. */
export async function getMyAvailability(): Promise<DayAvailability[]> {
  const user = await getSessionUser()
  const saved = await getAvailabilityForEmail(user.email)

  if (saved.length === 0) {
    // Seed defaults: all 7 days, 06:00 – 23:00
    const email = normalizeEmail(user.email)
    await Promise.all(
      Array.from({ length: 7 }, (_, i) =>
        db.insert(prepMasterAvailability).values({
          id: randomUUID(),
          email,
          dayOfWeek: i,
          enabled: true,
          startTime: "06:00",
          endTime: "23:00",
        }).onConflictDoNothing(),
      ),
    )
    return buildWeekTemplate(
      Array.from({ length: 7 }, (_, i) => ({
        dayOfWeek: i,
        enabled: true,
        startTime: "06:00",
        endTime: "23:00",
      })),
    )
  }

  return buildWeekTemplate(saved)
}

/** Saves the logged-in prep master's weekly availability (upsert per day). */
export async function saveMyAvailability(
  week: DayAvailability[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getSessionUser()
    const email = normalizeEmail(user.email)

    for (const day of week) {
      // Basic validation: end must be after start when the day is enabled.
      if (day.enabled && day.endTime <= day.startTime) {
        return {
          ok: false,
          error: "Each enabled day must have an end time after its start time.",
        }
      }

      const existing = await db
        .select({ id: prepMasterAvailability.id })
        .from(prepMasterAvailability)
        .where(
          and(
            eq(prepMasterAvailability.email, email),
            eq(prepMasterAvailability.dayOfWeek, day.dayOfWeek),
          ),
        )
        .limit(1)

      if (existing[0]) {
        await db
          .update(prepMasterAvailability)
          .set({
            enabled: day.enabled,
            startTime: day.startTime,
            endTime: day.endTime,
            updatedAt: new Date(),
          })
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

    revalidatePath("/portal/availability")
    return { ok: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save availability"
    return { ok: false, error: message }
  }
}
