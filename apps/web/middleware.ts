import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up", "/pending", "/denied", "/api/auth", "/api/me", "/api/admin"]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user) return NextResponse.redirect(new URL("/sign-in", req.url))

  const [row] = await db
    .select({ status: userTable.status })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))

  const status = row?.status ?? "active"
  if (status === "pending") return NextResponse.redirect(new URL("/pending", req.url))
  if (status === "denied") return NextResponse.redirect(new URL("/denied", req.url))

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
