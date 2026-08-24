import "server-only"
import { unstable_cache } from "next/cache"
import {
  getPrepMasterByEmail,
  getBookingsForPrepMaster,
  getBookingsForUserId,
} from "@/lib/airtable"
import { resolveClientProfile, getPlansForUser } from "@/lib/profile-core"

// 30-second TTL for all Airtable reads.
// Short enough that booking status changes show up quickly;
// long enough to absorb burst traffic from many users opening the app together.
const TTL = 30

type ResolvedUser = { id: string; email: string; name: string }

export const getCachedMemberDashboard = (user: ResolvedUser) =>
  unstable_cache(
    async () => {
      const profile = await resolveClientProfile(user)
      const memberId = profile.effectiveUserId || user.id
      const [bookings, plans] = await Promise.all([
        getBookingsForUserId(memberId),
        getPlansForUser(memberId),
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
