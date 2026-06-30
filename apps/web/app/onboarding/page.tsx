export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getOrCreateProfile } from "@/app/actions/profile"
import { OnboardingForm } from "@/components/onboarding-form"
import { BrandLogo } from "@/components/brand-logo"

export default async function OnboardingPage() {
  const profile = await getOrCreateProfile()
  // If they've already filled in any profile detail, skip onboarding
  if (!profile.isNewProfile && (profile.phone || profile.goals || profile.parentEmail)) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo />
          <div>
            <h1 className="font-heading text-2xl font-semibold mt-4">
              Welcome, {profile.name.split(" ")[0]}!
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Let's set up your profile. Everything here is optional — you can update it any time.
            </p>
          </div>
        </div>
        <OnboardingForm recordId={profile.recordId} />
      </div>
    </main>
  )
}
