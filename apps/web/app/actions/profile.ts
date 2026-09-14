"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { TABLES, appBase, type ClientFields, type MemberPlan, getPlansForUser } from "@/lib/airtable"
import { sendEmail, parentInviteEmail } from "@/lib/email"
import { resolveClientProfile } from "@/lib/profile-core"

export type { ClientProfile } from "@/lib/profile-core"

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user
}

export async function getOrCreateProfile({
  noCreate = false,
  resolvedUser,
}: {
  noCreate?: boolean
  resolvedUser?: { id: string; email: string; name: string }
} = {}) {
  const user = resolvedUser ?? await getSessionUser()
  return resolveClientProfile(user, noCreate)
}

export async function getMyPlans(resolvedUserId?: string, fallbackEmail?: string): Promise<MemberPlan[]> {
  const id = resolvedUserId ?? (await getSessionUser()).id
  return getPlansForUser(id, fallbackEmail)
}

export async function updateProfile(input: {
  recordId: string
  name?: string
  phone: string
  goals: string
  parentEmail?: string
  memberName?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getSessionUser()
    // Verify the caller owns this Airtable record — either directly or as a parent viewing a child
    const profile = await resolveClientProfile({ id: user.id, email: user.email, name: user.name ?? "" }, true)
    if (!profile || profile.recordId !== input.recordId) {
      return { ok: false, error: "Unauthorized" }
    }
    await appBase.update<ClientFields>(TABLES.clients, input.recordId, {
      ...(input.name ? { Name: input.name } : {}),
      Phone: input.phone,
      Goals: input.goals,
      ...(input.parentEmail !== undefined ? { "Parent Email": input.parentEmail } : {}),
    })
    revalidatePath("/dashboard/profile")

    // Send parent invite email when a parent email is provided
    if (input.parentEmail?.trim()) {
      const childName = input.memberName ?? input.name ?? user.name ?? "your child"
      const { subject, html } = parentInviteEmail({ childName, parentEmail: input.parentEmail.trim() })
      sendEmail({ to: input.parentEmail.trim(), subject, html }).catch(() => {})
    }

    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update profile"
    return { ok: false, error: message }
  }
}

/** Returns all children linked to the current parent account (by Parent Email in Airtable). */
export async function getLinkedChildren(): Promise<{ userId: string; name: string; status: string }[]> {
  "use server"
  const { getSessionUserWithRole } = await import("@/lib/roles")
  const { appBase, TABLES, isAirtableConfigured } = await import("@/lib/airtable")
  const { db: dbInstance } = await import("@/lib/db")
  const { user: userTable } = await import("@/lib/db/schema")
  const { inArray } = await import("drizzle-orm")
  const user = await getSessionUserWithRole()
  if (!user || !isAirtableConfigured()) return []
  try {
    const safe = user.email.trim().toLowerCase().replace(/'/g, "\\'")
    const records = await appBase.list(TABLES.clients, {
      filterByFormula: `LOWER({Parent Email}) = '${safe}'`,
      revalidate: 0,
    })
    const withIds = records.filter((r: { fields: Record<string, unknown> }) => r.fields["User ID"])
    if (withIds.length === 0) return []
    const userIds = withIds.map((r: { fields: Record<string, unknown> }) => r.fields["User ID"] as string)
    const dbUsers = await dbInstance.select({ id: userTable.id, status: userTable.status }).from(userTable).where(inArray(userTable.id, userIds))
    const statusMap = Object.fromEntries(dbUsers.map((u) => [u.id, u.status ?? "active"]))
    return withIds.map((r: { fields: Record<string, unknown> }) => ({
      userId: r.fields["User ID"] as string,
      name: (r.fields["Name"] as string) ?? "Child",
      status: statusMap[r.fields["User ID"] as string] ?? "pending",
    }))
  } catch {
    return []
  }
}
