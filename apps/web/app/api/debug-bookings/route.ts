import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { TABLES, appBase, type BookingFields } from "@/lib/airtable"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "not logged in" }, { status: 401 })

  const userId = session.user.id
  const records = await appBase.list<BookingFields>(TABLES.bookings, {
    filterByFormula: `{User ID} = '${userId.replace(/'/g, "\\'")}'`,
    sort: [{ field: "Date", direction: "desc" }],
    revalidate: 0,
  })

  return NextResponse.json({
    userId,
    bookings: records.map((r) => ({ id: r.id, ...r.fields })),
  })
}
