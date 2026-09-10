export default function OnboardingPage() {
  return (
    <div className="-mx-5 -mt-8">
      <iframe
        src="/onboarding-deck.html"
        className="w-full border-0"
        style={{ height: "calc(100vh - 112px)" }}
        title="PrepMaster Onboarding"
      />
    </div>
  )
}
