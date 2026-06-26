"use server"

import { randomUUID } from "crypto"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { isAdminEmail } from "@/lib/roles"
import { db } from "@/lib/db"
import { prepMasterInvite } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  adminGetAllMembers,
  adminGetAllBookings,
  adminGetAllWorkers,
  adminAddCredits,
  adminGetAllPlans,
  adminUpdateWorker,
  adminCreateMember,
  adminCreateWorker,
  createMemberPlan,
  getActivePlanForUser,
  setPlanStatus,
  TABLES,
  appBase,
  type ClientFields,
  type AdminMember,
  type AdminBooking,
  type AdminWorker,
  type MemberPlan,
} from "@/lib/airtable"

const SINGLE_SESSION_PLAN_NAMES: Record<string, string> = {
  "60 min": "60-Min Single",
  "45 min": "45-Min Single",
  "30 min": "30-Min Single",
}
import { PACKAGES, type DancePackage } from "@/lib/packages"

async function assertAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || !isAdminEmail(session.user.email)) {
    throw new Error("Unauthorized")
  }
}

export async function getAdminData(): Promise<{
  members: AdminMember[]
  bookings: AdminBooking[]
  workers: AdminWorker[]
  plans: MemberPlan[]
  packages: DancePackage[]
}> {
  await assertAdmin()
  const [members, bookings, workers, plans] = await Promise.all([
    adminGetAllMembers(),
    adminGetAllBookings(),
    adminGetAllWorkers(),
    adminGetAllPlans(),
  ])
  return { members, bookings, workers, plans, packages: PACKAGES }
}

export async function addComplimentaryCredits(
  member: { id: string; userId: string; email: string; creditsRemaining: number },
  label: string,
): Promise<{ ok: true; plan: MemberPlan } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    const planName = SINGLE_SESSION_PLAN_NAMES[label]
    if (!planName) return { ok: false, error: "Invalid session label." }
    const plan = await createMemberPlan({
      userId: member.userId,
      memberEmail: member.email,
      planName,
      sessions: 1,
      pricePaid: 0,
    })
    await adminAddCredits(member.id, member.creditsRemaining, 1)
    revalidatePath("/admin")
    revalidatePath("/dashboard")
    return { ok: true, plan }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to add session." }
  }
}

export async function adminAssignPlan(
  member: { id: string; userId: string; email: string; creditsRemaining: number },
  packageId: string,
): Promise<{ ok: true; plan: MemberPlan } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    const pkg = PACKAGES.find((p) => p.id === packageId)
    if (!pkg) return { ok: false, error: "Invalid package." }

    // Mark any existing active plan as Inactive before assigning the new one
    const existingActive = await getActivePlanForUser(member.userId)
    if (existingActive) await setPlanStatus(existingActive.id, "Inactive")

    const plan = await createMemberPlan({
      userId: member.userId,
      memberEmail: member.email,
      planName: pkg.name,
      sessions: pkg.sessions,
      pricePaid: pkg.price,
      expiryDays: pkg.expiryDays,
    })

    // Add the package's sessions as credits on the member record
    await adminAddCredits(member.id, member.creditsRemaining, pkg.sessions)
    revalidatePath("/admin")
    revalidatePath("/dashboard")
    return { ok: true, plan }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to assign plan.",
    }
  }
}

export async function updatePrepMaster(
  workerId: string,
  fields: {
    name?: string
    email?: string
    phone?: string
    region?: string
    address?: string
    hourlyRate?: number
    active?: boolean
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    await adminUpdateWorker(workerId, fields)
    revalidatePath("/admin")
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update Prep Master.",
    }
  }
}

export async function createMember(input: {
  name: string
  email: string
  phone?: string
  goals?: string
  creditsRemaining?: number
}): Promise<{ ok: true; member: AdminMember } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    if (!input.name.trim()) return { ok: false, error: "Name is required." }
    if (!input.email.trim()) return { ok: false, error: "Email is required." }
    const member = await adminCreateMember(input)
    revalidatePath("/admin")
    return { ok: true, member }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create member.",
    }
  }
}

export async function addPrepMaster(input: {
  name: string
  email: string
  phone?: string
  region?: string
  hourlyRate?: number
}): Promise<{ ok: true; worker: AdminWorker } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    if (!input.name.trim()) return { ok: false, error: "Name is required." }
    const email = input.email.trim().toLowerCase()
    if (!email) return { ok: false, error: "Email is required." }

    // Create the Airtable Worker record
    const worker = await adminCreateWorker({ ...input, email })

    // Create or reactivate the DB invite so they can sign in as a Prep Master
    const existing = await db
      .select({ id: prepMasterInvite.id, status: prepMasterInvite.status })
      .from(prepMasterInvite)
      .where(eq(prepMasterInvite.email, email))
      .limit(1)

    if (existing[0]) {
      if (existing[0].status === "revoked") {
        await db
          .update(prepMasterInvite)
          .set({ status: "pending", name: input.name.trim() })
          .where(eq(prepMasterInvite.id, existing[0].id))
      }
    } else {
      await db.insert(prepMasterInvite).values({
        id: randomUUID(),
        email,
        name: input.name.trim(),
        invitedBy: "admin",
        status: "pending",
      })
    }

    revalidatePath("/admin")
    return { ok: true, worker }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add Prep Master.",
    }
  }
}


export async function adminSetCredits(
  memberId: string,
  newCredits: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    if (newCredits < 0 || newCredits > 9999) return { ok: false, error: "Invalid credit amount." }
    await appBase.update<ClientFields>(TABLES.clients, memberId, {
      "Credits Remaining": newCredits,
    })
    revalidatePath("/admin")
    revalidatePath("/dashboard")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to set credits." }
  }
}

export async function adminRemovePlan(
  planId: string,
  memberId: string,
  planSessions: number,
  currentCredits: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    // Delete the plan record entirely so it stays gone after refresh
    await appBase.destroy(TABLES.plans, planId)
    // Deduct the plan's sessions from the member's credits (floor at 0)
    const newCredits = Math.max(0, currentCredits - planSessions)
    await appBase.update<ClientFields>(TABLES.clients, memberId, {
      "Credits Remaining": newCredits,
    })
    revalidatePath("/admin")
    revalidatePath("/dashboard")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to remove plan." }
  }
}
