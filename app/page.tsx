import Image from "next/image"
import { redirect } from "next/navigation"
import { BrandLogo } from "@/components/brand-logo"
import { AuthForm } from "@/components/auth-form"
import { CalendarCheck, Sparkles, Trophy } from "lucide-react"
import { getSessionUserWithRole, homePathForRole } from "@/lib/roles"

export default async function HomePage() {
  const user = await getSessionUserWithRole()
  if (user) redirect(homePathForRole(user.role))

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <BrandLogo />
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 lg:grid-cols-2 lg:gap-12 lg:pt-12">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
            <Sparkles className="size-4 text-primary" />
            Private coaching for serious dancers
          </span>
          <h1 className="text-balance font-heading text-4xl font-light leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Train with elite prep masters. Book your private session.
          </h1>
          <p className="max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
            College Dance Prep connects you with expert coaches for one-on-one
            sessions. Pick your prep master, choose a date, and show up ready to
            level up.
          </p>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <AuthForm />
          </div>

          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <li className="flex items-center gap-2">
              <CalendarCheck className="size-4 text-primary" />
              Flexible scheduling
            </li>
            <li className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" />
              Vetted prep masters
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Session packages
            </li>
          </ul>
        </div>

        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border bg-muted shadow-sm lg:aspect-[4/5]">
          <Image
            src="/images/hero-dancer.png"
            alt="A contemporary dancer mid-leap in a sunlit studio"
            fill
            priority
            className="object-cover"
            sizes="(min-width: 1024px) 40vw, 100vw"
          />
        </div>
      </section>
    </main>
  )
}
