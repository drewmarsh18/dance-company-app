import { betterAuth } from "better-auth"
import { expo } from "@better-auth/expo"
import { pool, db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const auth = betterAuth({
  plugins: [expo()],
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  // Email + password is enabled for now so the app is fully testable without
  // any external OAuth setup.
  emailAndPassword: {
    enabled: true,
  },
  // Google stays wired up but only activates once its credentials are present,
  // so it's a one-step restore later (just add GOOGLE_CLIENT_ID/SECRET).
  ...(process.env.GOOGLE_CLIENT_ID
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            // Accept ID tokens from web or native iOS/Android client IDs.
            // Google's tokeninfo endpoint validates signature, expiry, and issuer;
            // we only need to check that the audience is one we own.
            verifyIdToken: async (token: string) => {
              try {
                const res = await fetch(
                  `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`,
                )
                if (!res.ok) return false
                const payload = await res.json()
                const allowedAudiences = [
                  process.env.GOOGLE_CLIENT_ID!,
                  ...(process.env.GOOGLE_IOS_CLIENT_ID
                    ? [process.env.GOOGLE_IOS_CLIENT_ID]
                    : []),
                ]
                return allowedAudiences.includes(payload.aud)
              } catch {
                return false
              }
            },
          },
        },
      }
    : {}),
  trustedOrigins: [
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
    // The v0 preview renders the app inside an iframe served from a
    // *.vusercontent.net host that varies per session. Trust the wildcard so
    // sign-in/sign-up work in the preview without hardcoding a single host.
    "https://*.vusercontent.net",
    // Native mobile app (Expo) — no browser origin header
    "cdp://",
    "cdp://localhost",
    // Allow local origins during development/testing.
    ...(process.env.NODE_ENV === "development"
      ? ["http://localhost:3000", `http://localhost:${process.env.PORT ?? 3000}`]
      : []),
  ],
  advanced: {
    ...(process.env.NODE_ENV === "development"
      ? {
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        }
      : {}),
    // Native apps don't send an Origin header — disable the check so the
    // Expo mobile client can reach the auth endpoints.
    disableCSRFCheck: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  accountLinking: {
    enabled: true,
    trustedProviders: ["google"],
  },
  databaseHooks: {
    user: {
      create: {
        after: async (newUser) => {
          // Admins are auto-approved; everyone else starts as pending
          const adminEmails = (process.env.ADMIN_EMAILS ?? "")
            .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
          if (!adminEmails.includes(newUser.email.trim().toLowerCase())) {
            await db.update(userTable)
              .set({ status: "pending" })
              .where(eq(userTable.id, newUser.id))
          }
        },
      },
    },
  },
})
