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
        <p className="mt-2 text-sm text-muted-foreground">Last updated: August 3, 2026</p>

        <div className="mt-10 flex flex-col gap-8 text-base leading-relaxed text-muted-foreground">

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">1. Who We Are</h2>
            <p>
              College Dance Prep ("CDP," "we," "us," or "our") operates the College Dance Prep mobile app
              and website at <span className="text-foreground">dance-company-app.vercel.app</span>. We
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
            <h2 className="mb-2 text-lg font-semibold text-foreground">5. Data Sharing</h2>
            <p>
              We do not sell or rent your personal information. We share data only:
            </p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>With your PrepMaster, limited to your name, email, and session details needed to fulfill a booking.</li>
              <li>With third-party services that power the app (Vercel for hosting, Neon for database, Airtable for booking records, Google APIs for calendar integration). Each is bound by their own privacy policies.</li>
              <li>If required by law.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">6. Data Retention</h2>
            <p>
              We retain your account data as long as your account is active. You may request deletion of
              your account and associated data at any time by emailing us at{" "}
              <a href="mailto:collegedanceprep@gmail.com" className="text-primary underline underline-offset-4">
                collegedanceprep@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">7. Security</h2>
            <p>
              We use industry-standard security measures including encrypted connections (HTTPS) and
              hashed passwords. Google OAuth tokens are stored securely and never exposed to other users.
            </p>
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
