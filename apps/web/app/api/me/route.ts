import { NextResponse } from "next/server"
import { getSessionUserWithRole } from "@/lib/roles"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const user = await getSessionUserWithRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [row] = await db.select({ status: userTable.status }).from(userTable).where(eq(userTable.id, user.id))
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: row?.status ?? "active",
  })
}
