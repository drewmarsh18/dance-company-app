import "server-only"
import { unstable_cache } from "next/cache"
import {
  getPrepMasterByEmail,
  getBookingsForPrepMaster,
  getBookingsForUserId,
} from "@/lib/airtable"
import { resolveClientProfile, getPlansForUser } from "@/lib/profile-core"

// 5-second TTL — short enough that credit/booking changes are visible
// almost immediately; revalidateTag calls on every mutation clear it instantly.
const TTL = 5

type ResolvedUser = { id: string; email: string; name: string }

export const getCachedMemberDashboard = (user: ResolvedUser) =>
  unstable_cache(
    async () => {
      const profile = await resolveClientProfile(user)
      const memberId = profile.effectiveUserId || user.id
      const [bookings, plans] = await Promise.all([
        getBookingsForUserId(memberId),
        getPlansForUser(memberId, profile.email || user.email),
      ])
      return { profile, bookings, plans }
    },
    [`member-dashboard-${user.id}`],
    { revalidate: TTL, tags: [`member-${user.id}`] },
  )()

export const getCachedPortalDashboard = (email: string) =>
  unstable_cache(
    async () => {
      const prepMaster = await getPrepMasterByEmail(email)
      if (!prepMaster) return null
      const bookings = await getBookingsForPrepMaster(prepMaster.name)
      return { prepMaster, bookings }
    },
    [`portal-dashboard-${email}`],
    { revalidate: TTL, tags: [`portal-${email}`] },
  )()
