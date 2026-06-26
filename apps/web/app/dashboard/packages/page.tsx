import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { PACKAGES, PER_PRIVATE, SINGLE_HOUR_PRICE, formatPrice } from "@/lib/packages"
import { PackageCard } from "@/components/package-card"
import { PerPrivateCard } from "@/components/per-private-card"

export default async function PackagesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/")

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-balance md:text-4xl">
          Choose your training plan
        </h1>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Every plan includes private one-on-one sessions with your choice of prep
          master. Bundle hourly privates to drop your rate from{" "}
          {formatPrice(SINGLE_HOUR_PRICE)} to {formatPrice(99)} per session.
        </p>
      </div>

      {/* Packages */}
      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold tracking-tight">
          Packages
        </h2>
        <p className="text-sm text-muted-foreground">
          Hourly privates — the more you commit, the more you save.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PACKAGES.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      </section>

      {/* Per Private */}
      <section className="mt-12">
        <h2 className="font-heading text-xl font-bold tracking-tight">
          Per Private
        </h2>
        <p className="text-sm text-muted-foreground">
          Prefer to pay as you go? Book a single private session.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          {PER_PRIVATE.map((s) => (
            <PerPrivateCard key={s.id} session={s} />
          ))}
        </div>
      </section>


    </div>
  )
}
