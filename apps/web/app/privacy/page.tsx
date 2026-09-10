import { BrandLogo } from "@/components/brand-logo"
import Link from "next/link"

export const metadata = {
  title: "Privacy Policy — College Dance Prep",
  description: "Privacy policy for the College Dance Prep app and website.",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
        <Link href="/"><BrandLogo /></Link>
      </header>

      <article className="mx-auto max-w-4xl px-5 pb-24 pt-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: September 10, 2026</p>

        <div className="mt-10 flex flex-col gap-8 text-base leading-relaxed text-muted-foreground">

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">1. Who We Are</h2>
            <p>
              College Dance Prep ("CDP," "we," "us," or "our") operates the College Dance Prep mobile app
              and website at <span className="text-foreground">app.collegedanceprep.com</span>. We
              provide a platform that connects dancers with PrepMasters for private training sessions.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">2. Information We Collect</h2>
            <ul className="ml-5 list-disc space-y-1">
              <li><span className="text-foreground font-medium">Account information:</span> name, email address, and password (or Google account details if you sign in with Google).</li>
              <li><span className="text-foreground font-medium">Booking information:</span> session dates, times, notes, and session type.</li>
              <li><span className="text-foreground font-medium">Google Calendar access:</span> if you sign in with Google, we request access to your Google Calendar solely to create and display CDP session events on your behalf. We do not read, store, or share any of your existing calendar events.</li>
              <li><span className="text-foreground font-medium">Usage data:</span> basic analytics such as pages visited and features used, collected through Vercel Analytics.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">3. How We Use Your Information</h2>
            <ul className="ml-5 list-disc space-y-1">
              <li>To create and manage your account.</li>
              <li>To facilitate bookings between members and PrepMasters.</li>
              <li>To automatically add your CDP sessions to your Google Calendar (only when you sign in with Google and grant calendar permission).</li>
              <li>To send booking confirmation and notification emails.</li>
              <li>To improve the app and diagnose technical issues.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">4. Google Calendar Integration</h2>
            <p>
              When you sign in with Google, we request the{" "}
              <code className="rounded bg-secondary px-1 py-0.5 text-sm text-foreground">calendar.events</code>{" "}
              scope. This allows us to:
            </p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>Create a calendar event when you book a CDP session.</li>
              <li>Display your CDP session events within the app calendar view.</li>
            </ul>
            <p className="mt-2">
              We do <span className="text-foreground font-medium">not</span> read, modify, or delete any
              calendar events that were not created by CDP. You can revoke calendar access at any time via
              your{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                Google Account permissions
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">5. Data Sharing and Disclosure</h2>
            <p>
              We do not sell or rent your personal information. We do not transfer or disclose Google user data to any third party except as described below:
            </p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li><span className="text-foreground font-medium">PrepMasters:</span> Your name, email, and session details are shared with the PrepMaster you book, solely to fulfill that booking. Google user data (such as your Google account email) is not shared with PrepMasters beyond what you have provided directly.</li>
              <li><span className="text-foreground font-medium">Infrastructure providers:</span> We use Vercel (hosting), Neon (database), and Airtable (booking records) to operate the service. These providers process data on our behalf and are contractually prohibited from using it for other purposes.</li>
              <li><span className="text-foreground font-medium">Google APIs:</span> Google Calendar data is passed directly to the Google Calendar API to create session events. We do not store, transfer, or share your Google Calendar data with any other party.</li>
              <li><span className="text-foreground font-medium">Legal requirements:</span> We may disclose information if required to do so by law or in response to valid legal process.</li>
            </ul>
            <p className="mt-2">
              We do not use Google user data for advertising, profiling, or any purpose other than the specific functionality described in this policy.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">6. Data Retention and Deletion</h2>
            <p>
              We retain your account data for as long as your account is active. Google OAuth tokens (access tokens and refresh tokens) are stored in our database solely to maintain your Google Calendar integration and are revoked and deleted when you disconnect the integration or delete your account.
            </p>
            <p className="mt-2">
              You may request deletion of your account and all associated data — including any stored Google OAuth tokens — at any time by emailing us at{" "}
              <a href="mailto:collegedanceprep@gmail.com" className="text-primary underline underline-offset-4">
                collegedanceprep@gmail.com
              </a>
              . We will process deletion requests within 30 days. You can also revoke CDP's access to your Google account at any time via{" "}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                Google Account permissions
              </a>
              ; revoking access does not delete your CDP account.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">7. Data Protection</h2>
            <p>
              We implement the following measures to protect your data, including any Google user data:
            </p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li><span className="text-foreground font-medium">Encryption in transit:</span> All data is transmitted over HTTPS/TLS.</li>
              <li><span className="text-foreground font-medium">Encryption at rest:</span> Our database (Neon/PostgreSQL) encrypts data at rest.</li>
              <li><span className="text-foreground font-medium">Token security:</span> Google OAuth access tokens and refresh tokens are stored in our database and are never exposed to other users or included in client-side responses.</li>
              <li><span className="text-foreground font-medium">Access control:</span> Only authorized CDP systems can access stored Google tokens. Tokens are used solely to call the Google Calendar API on your behalf.</li>
              <li><span className="text-foreground font-medium">Minimal scope:</span> We request only the <code className="rounded bg-secondary px-1 py-0.5 text-sm text-foreground">https://www.googleapis.com/auth/calendar.events</code> scope, limited to creating and reading CDP-created calendar events.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">8. Children's Privacy</h2>
            <p>
              Our service is not directed to children under 13. We do not knowingly collect personal
              information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">9. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. We will notify users of material changes via
              email or an in-app notice. Continued use of the service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">10. Contact Us</h2>
            <p>
              Questions about this policy? Email us at{" "}
              <a href="mailto:collegedanceprep@gmail.com" className="text-primary underline underline-offset-4">
                collegedanceprep@gmail.com
              </a>
              .
            </p>
          </section>

        </div>
      </article>
    </main>
  )
}
