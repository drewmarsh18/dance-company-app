import type { MemberPlan } from "@/lib/airtable"

/** Returns the status to display, accounting for expiry. */
export function planDisplayStatus(plan: MemberPlan): string {
  if (plan.status === "Active" && plan.expiresAt && new Date(plan.expiresAt) < new Date()) {
    return "Inactive"
  }
  return plan.status
}
