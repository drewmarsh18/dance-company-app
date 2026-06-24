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
}

async function findClientRecord(userId: string) {
  const safeId = userId.replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `{User ID} = '${safeId}'`,
    maxRecords: 1,
  })
  return records[0] ?? null
}

async function findClientByEmail(email: string) {
  const safe = email.trim().toLowerCase().replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `LOWER({Email}) = '${safe}'`,
    maxRecords: 1,
  })
  return records[0] ?? null
}

// Ensures the logged-in dancer exists in the Clients table; returns profile.
// Checks User ID first, then falls back to email so admin-created records link on first sign-in.
// Pass noCreate:true to skip record creation (e.g. admin previewing member view).
export async function getOrCreateProfile({ noCreate = false }: { noCreate?: boolean } = {}): Promise<ClientProfile> {
  const user = await getSessionUser()
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

  if (!record && !noCreate) {
    record = await appBase.create<ClientFields>(TABLES.clients, {
      Name: user.name,
      Email: user.email,
      "User ID": user.id,
      "Credits Remaining": 0,
    })
  }

  return {
    recordId: record?.id ?? "",
    name: record?.fields.Name ?? user.name,
    email: record?.fields.Email ?? user.email,
    phone: record?.fields.Phone ?? "",
    goals: record?.fields.Goals ?? "",
    creditsRemaining: record?.fields["Credits Remaining"] ?? 0,
  }
}

export async function getMyPlans(): Promise<MemberPlan[]> {
  const user = await getSessionUser()
  return getPlansForUser(user.id)
}

export async function updateProfile(input: {
  recordId: string
  name: string
  phone: string
  goals: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await getSessionUser()
    await appBase.update<ClientFields>(TABLES.clients, input.recordId, {
      Name: input.name,
      Phone: input.phone,
      Goals: input.goals,
    })
    revalidatePath("/dashboard/profile")
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update profile"
    return { ok: false, error: message }
  }
}
