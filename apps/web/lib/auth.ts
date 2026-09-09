import { betterAuth } from "better-auth"
import { expo } from "@better-auth/expo"
import { pool, db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { sendEmail, sendPasswordResetEmail, newMemberPendingEmail } from "@/lib/email"
import { sendPushToUser } from "@/lib/push"

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
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ name: user.name, email: user.email, url })
    },
  },
  socialProviders: {
    // Apple Sign-In: verify the identity token from expo-apple-authentication
    // against Apple's JWKS. No server-side credentials needed for native-only flow.
    apple: {
      clientId: process.env.APPLE_CLIENT_ID ?? "com.collegedanceprep.app",
      clientSecret: process.env.APPLE_CLIENT_SECRET ?? "",
      verifyIdToken: async (token: string) => {
        try {
          const { createRemoteJWKSet, jwtVerify } = await import("jose")
          const JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"))
          const { payload } = await jwtVerify(token, JWKS, {
            issuer: "https://appleid.apple.com",
            audience: process.env.APPLE_CLIENT_ID ?? "com.collegedanceprep.app",
          })
          if (!payload.sub) return false
          return {
            user: {
              id: payload.sub as string,
              email: (payload.email as string | undefined) ?? "",
              name: (payload.name as string | undefined) ?? (payload.email as string | undefined) ?? "",
              emailVerified: (payload.email_verified as string | undefined) === "true",
            },
          }
        } catch {
          return false
        }
      },
    },
    // Google stays wired up but only activates once its credentials are present,
    // so it's a one-step restore later (just add GOOGLE_CLIENT_ID/SECRET).
    ...(process.env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            prompt: "select_account",
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
                if (!allowedAudiences.includes(payload.aud)) return false
                return {
                  user: {
                    id: payload.sub,
                    email: payload.email,
                    name: payload.name ?? payload.email,
                    image: payload.picture ?? null,
                    emailVerified: payload.email_verified === "true",
                  },
                }
              } catch {
                return false
              }
            },
          },
        }
    : {}),
  },
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
    trustedProviders: ["google", "apple"],
  },
  databaseHooks: {
    user: {
      create: {
        after: async (newUser) => {
          // Admins and PrepMasters are auto-approved; everyone else starts as pending
          const adminEmails = (process.env.ADMIN_EMAILS ?? "")
            .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
          const email = newUser.email.trim().toLowerCase()
          const isAdmin = adminEmails.includes(email)

          // Always set an explicit status immediately — never rely on the DB default
          // PrepMasters are recognized by: (1) invite table, OR (2) Airtable Workers roster.
          // Checking both means PrepMasters are auto-approved even if their invite record
          // wasn't created yet (e.g. admin hasn't visited the PrepMasters tab).
          let isPrepMaster = false
          try {
            const { prepMasterInvite } = await import("@/lib/db/schema")
            const { eq: eqOp, and, ne } = await import("drizzle-orm")
            const { getPrepMasterByEmail, isAirtableConfigured } = await import("@/lib/airtable")
            const [inviteCheck, workerCheck] = await Promise.allSettled([
              db
                .select({ status: prepMasterInvite.status })
                .from(prepMasterInvite)
                .where(and(eqOp(prepMasterInvite.email, email), ne(prepMasterInvite.status, "revoked")))
                .limit(1),
              isAirtableConfigured() ? getPrepMasterByEmail(email) : Promise.resolve(null),
            ])
            const invite = inviteCheck.status === "fulfilled" ? inviteCheck.value[0] : null
            const worker = workerCheck.status === "fulfilled" ? workerCheck.value : null
            isPrepMaster = Boolean(invite) || Boolean(worker)
            // Auto-create the invite record so future lookups don't need Airtable
            if (!invite && worker) {
              const { randomUUID } = await import("crypto")
              const { prepMasterInvite: pmi } = await import("@/lib/db/schema")
              await db.insert(pmi).values({
                id: randomUUID(),
                email,
                name: worker.name,
                invitedBy: "system",
                status: "pending",
              }).onConflictDoNothing()
            }
          } catch { /* non-fatal */ }

          // Check if this email is a parent/guardian for an existing member —
          // parents are auto-approved, no admin review needed.
          let isParent = false
          try {
            if (isAirtableConfigured()) {
              const { appBase, TABLES } = await import("@/lib/airtable")
              const safe = email.replace(/'/g, "\\'")
              const children = await appBase.list(TABLES.clients, {
                filterByFormula: `LOWER({Parent Email}) = '${safe}'`,
                maxRecords: 1,
                revalidate: 0,
              })
              isParent = children.length > 0
            }
          } catch { /* non-fatal */ }

          if (isAdmin || isPrepMaster || isParent) {
            await db.update(userTable).set({ status: "active" }).where(eq(userTable.id, newUser.id))
            return
          }

          await db.update(userTable)
            .set({ status: "pending" })
            .where(eq(userTable.id, newUser.id))

          // Notify all admins via email + push
          const { inArray } = await import("drizzle-orm")
          const admins = adminEmails.length > 0
            ? await db
                .select({ id: userTable.id, email: userTable.email })
                .from(userTable)
                .where(inArray(userTable.email, adminEmails))
            : []

          const appUrl = process.env.BETTER_AUTH_URL
            ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
              ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
              : "https://dance-company-app.vercel.app")
          const reviewUrl = `${appUrl}/admin`

          const { subject, html } = newMemberPendingEmail({
            memberName: newUser.name,
            memberEmail: newUser.email,
            reviewUrl,
          })

          await Promise.allSettled([
            ...admins.map((admin) => sendEmail({ to: admin.email, subject, html })),
            ...admins.map((admin) =>
              sendPushToUser(admin.id, {
                title: "New member request",
                body: `${newUser.name} signed up and is awaiting approval.`,
                data: { route: "/admin" },
              })
            ),
          ])
        },
      },
    },
  },
})
