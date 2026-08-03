import { NextResponse } from "next/server"
import { getSessionUserWithRole } from "@/lib/roles"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq, or } from "drizzle-orm"

export async function GET() {
  const me = await getSessionUserWithRole()
  if (me?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const rows = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email, status: userTable.status, createdAt: userTable.createdAt })
    .from(userTable)
    .where(or(eq(userTable.status, "pending"), eq(userTable.status, "denied")))
    .orderBy(userTable.createdAt)

  return NextResponse.json(rows)
}
