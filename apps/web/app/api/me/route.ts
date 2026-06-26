import { NextResponse } from "next/server"
import { getSessionUserWithRole } from "@/lib/roles"

export async function GET() {
  const user = await getSessionUserWithRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  })
}
