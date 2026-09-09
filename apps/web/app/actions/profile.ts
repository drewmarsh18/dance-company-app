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

export async function getMyPlans(resolvedUserId?: string): Promise<MemberPlan[]> {
  const id = resolvedUserId ?? (await getSessionUser()).id
  return getPlansForUser(id)
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
