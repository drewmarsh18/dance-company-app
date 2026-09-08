import { betterAuth } from "better-auth"
import { expo } from "@better-auth/expo"
import { pool, db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { sendEmail, newMemberPendingEmail } from "@/lib/email"
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
      if (!process.env.RESEND_API_KEY) return
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: "College Dance Prep <onboarding@resend.dev>",
        to: user.email,
        subject: "Reset your password",
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 16px">
            <div style="background:#e91e8c;border-radius:8px 8px 0 0;padding:24px 32px;text-align:center">
              <div style="color:#fff;font-size:20px;font-weight:600">College Dance Prep</div>
            </div>
            <div style="background:#fff;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 8px 8px;padding:28px 32px">
              <p style="margin:0 0 16px;font-size:15px;color:#111">Hi ${user.name ?? user.email},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#444">We received a request to reset your password. Click the button below — this link expires in 1 hour.</p>
              <a href="${url}" style="display:inline-block;background:#e91e8c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px">Reset password</a>
              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af">If you didn't request this, you can safely ignore this email.</p>
            </div>
          </div>
        `,
      })
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
          // PrepMasters are recognized by the invite table; check inline to avoid circular import
          let isPrepMaster = false
          try {
            const { prepMasterInvite } = await import("@/lib/db/schema")
            const { eq: eqOp, and, ne } = await import("drizzle-orm")
            const [invite] = await db
              .select({ status: prepMasterInvite.status })
              .from(prepMasterInvite)
              .where(and(eqOp(prepMasterInvite.email, email), ne(prepMasterInvite.status, "revoked")))
              .limit(1)
            isPrepMaster = Boolean(invite)
          } catch { /* non-fatal */ }

          if (isAdmin || isPrepMaster) {
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
