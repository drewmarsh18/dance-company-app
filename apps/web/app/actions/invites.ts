"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { prepMasterInvite } from "@/lib/db/schema"
import { getSessionUserWithRole } from "@/lib/roles"

async function requireAdmin() {
  const user = await getSessionUserWithRole()
  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized")
  }
  return user
}

export type Invite = {
  id: string
  email: string
  name: string | null
  status: string
  createdAt: string
  acceptedAt: string | null
}

export async function listInvites(): Promise<Invite[]> {
  await requireAdmin()
  const rows = await db
    .select()
    .from(prepMasterInvite)
    .orderBy(desc(prepMasterInvite.createdAt))
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    acceptedAt: r.acceptedAt ? r.acceptedAt.toISOString() : null,
  }))
}

export async function invitePrepMaster(input: {
  email: string
  name?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = await requireAdmin()
    const email = input.email.trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Please enter a valid email address." }
    }

    const existing = await db
      .select({ id: prepMasterInvite.id, status: prepMasterInvite.status })
      .from(prepMasterInvite)
      .where(eq(prepMasterInvite.email, email))
      .limit(1)

    if (existing[0]) {
      // Re-activate a previously revoked invite instead of erroring.
      if (existing[0].status === "revoked") {
        await db
          .update(prepMasterInvite)
          .set({ status: "pending", name: input.name?.trim() || null })
          .where(eq(prepMasterInvite.id, existing[0].id))
        revalidatePath("/admin")
        return { ok: true }
      }
      return { ok: false, error: "That email has already been invited." }
    }

    await db.insert(prepMasterInvite).values({
      id: randomUUID(),
      email,
      name: input.name?.trim() || null,
      invitedBy: admin.email,
      status: "pending",
    })

    revalidatePath("/admin")
    return { ok: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to invite PrepMaster."
    return { ok: false, error: message }
  }
}

export async function revokeInvite(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin()
    await db
      .update(prepMasterInvite)
      .set({ status: "revoked" })
      .where(eq(prepMasterInvite.id, id))
    revalidatePath("/admin")
    return { ok: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to revoke invite."
    return { ok: false, error: message }
  }
}
