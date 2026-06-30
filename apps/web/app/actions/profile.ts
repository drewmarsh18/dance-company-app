"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { TABLES, appBase, getPlansForUser, type ClientFields, type MemberPlan } from "@/lib/airtable"

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user
}

export type ClientProfile = {
  recordId: string
  name: string
  email: string
  phone: string
  goals: string
  creditsRemaining: number
  parentEmail: string
  /** The User ID to use for data queries — differs from auth user.id when logged in as a parent */
  effectiveUserId: string
  isParentView: boolean
  /** True only on the very first login — used to redirect new members to onboarding */
  isNewProfile: boolean
}

async function findClientRecord(userId: string) {
  const safeId = userId.replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `{User ID} = '${safeId}'`,
    maxRecords: 1,
    revalidate: 0,
  })
  return records[0] ?? null
}

async function findClientByEmail(email: string) {
  const safe = email.trim().toLowerCase().replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `LOWER({Email}) = '${safe}'`,
    maxRecords: 1,
    revalidate: 0,
  })
  return records[0] ?? null
}

async function findClientByParentEmail(parentEmail: string) {
  const safe = parentEmail.trim().toLowerCase().replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `LOWER({Parent Email}) = '${safe}'`,
    maxRecords: 1,
    revalidate: 0,
  })
  return records[0] ?? null
}

// Ensures the logged-in dancer exists in the Clients table; returns profile.
// Checks User ID first, then falls back to email so admin-created records link on first sign-in.
// Pass noCreate:true to skip record creation (e.g. admin previewing member view).
// Pass resolvedUser to skip the internal getSession DB call (use when session already resolved).
export async function getOrCreateProfile({
  noCreate = false,
  resolvedUser,
}: {
  noCreate?: boolean
  resolvedUser?: { id: string; email: string; name: string }
} = {}): Promise<ClientProfile> {
  const user = resolvedUser ?? await getSessionUser()
  let record = await findClientRecord(user.id)

  if (!record) {
    const byEmail = await findClientByEmail(user.email ?? "")
    if (byEmail) {
      if (!byEmail.fields["User ID"]) {
        // Pre-created by admin — stamp the User ID
        record = await appBase.update<ClientFields>(TABLES.clients, byEmail.id, {
          "User ID": user.id,
          Name: byEmail.fields.Name || user.name,
        })
      } else if (byEmail.fields["User ID"] === user.id) {
        // Already linked — use it directly
        record = byEmail
      }
    }
  }

  // Check if this user is a parent linked to a member account
  let isParentView = false
  if (!record) {
    const byParentEmail = await findClientByParentEmail(user.email ?? "")
    if (byParentEmail) {
      isParentView = true
      return {
        recordId: byParentEmail.id,
        name: byParentEmail.fields.Name ?? "",
        email: byParentEmail.fields.Email ?? "",
        phone: byParentEmail.fields.Phone ?? "",
        goals: byParentEmail.fields.Goals ?? "",
        creditsRemaining: byParentEmail.fields["Credits Remaining"] ?? 0,
        parentEmail: byParentEmail.fields["Parent Email"] ?? user.email,
        effectiveUserId: byParentEmail.fields["User ID"] ?? "",
        isParentView: true,
        isNewProfile: false,
      }
    }
  }

  let isNewProfile = false
  if (!record && !noCreate) {
    record = await appBase.create<ClientFields>(TABLES.clients, {
      Name: user.name,
      Email: user.email,
      "User ID": user.id,
      "Credits Remaining": 0,
    })
    isNewProfile = true
  }

  return {
    recordId: record?.id ?? "",
    name: record?.fields.Name ?? user.name,
    email: record?.fields.Email ?? user.email,
    phone: record?.fields.Phone ?? "",
    goals: record?.fields.Goals ?? "",
    creditsRemaining: record?.fields["Credits Remaining"] ?? 0,
    parentEmail: record?.fields["Parent Email"] ?? "",
    effectiveUserId: record?.fields["User ID"] ?? user.id,
    isParentView,
    isNewProfile,
  }
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
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await getSessionUser()
    await appBase.update<ClientFields>(TABLES.clients, input.recordId, {
      ...(input.name ? { Name: input.name } : {}),
      Phone: input.phone,
      Goals: input.goals,
      ...(input.parentEmail !== undefined ? { "Parent Email": input.parentEmail } : {}),
    })
    revalidatePath("/dashboard/profile")
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update profile"
    return { ok: false, error: message }
  }
}
