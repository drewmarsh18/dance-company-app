"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateProfile, type ClientProfile } from "@/app/actions/profile"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, X, Users } from "lucide-react"

export function ProfileForm({ profile, isGoogleLinked = false, isParentView = false }: { profile: ClientProfile; isGoogleLinked?: boolean; isParentView?: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone)
  const [goals, setGoals] = useState(profile.goals)
  const [parentEmail, setParentEmail] = useState(profile.parentEmail ?? "")
  const [googleLinked, setGoogleLinked] = useState(isGoogleLinked)
  const [googleLinking, setGoogleLinking] = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try { return localStorage.getItem("member-google-nudge-dismissed") === "1" } catch { return false }
  })

  function dismissNudge() {
    try { localStorage.setItem("member-google-nudge-dismissed", "1") } catch {}
    setNudgeDismissed(true)
  }

  async function handleConnectGoogle() {
    setGoogleLinking(true)
    try {
      await authClient.linkSocial({ provider: "google", callbackURL: window.location.href })
    } catch {
      toast.error("Could not connect Google account.")
      setGoogleLinking(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateProfile({
        recordId: profile.recordId,
        name,
        phone,
        goals,
        parentEmail: parentEmail.trim() || undefined,
      })
      if (result.ok) {
        toast.success("Profile updated")
        router.refresh()
      } else {
        toast.error("Couldn't update profile", { description: result.error })
      }
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {isParentView && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-2 w-fit">
          <Users className="size-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Parent / Guardian View</span>
        </div>
      )}
      {!googleLinked && !nudgeDismissed && !isParentView && (
        <div className="relative flex items-center gap-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
            <svg viewBox="0 0 24 24" className="size-5" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Sign in faster with Google</p>
            <p className="text-xs text-muted-foreground mt-0.5">Link your Google account to skip the password next time you log in.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={handleConnectGoogle} disabled={googleLinking} type="button" className="shrink-0 text-xs font-semibold">
            {googleLinking ? "Connecting…" : "Link Google"}
          </Button>
          <button type="button" onClick={dismissNudge} className="absolute right-3 top-3 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors" aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      )}
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={profile.email} disabled />
        <p className="text-xs text-muted-foreground">
          Linked to your Google account.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="goals">Training goals</Label>
        <Textarea
          id="goals"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={4}
          placeholder="What are you working toward? Auditions, technique, choreography…"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="parentEmail">Parent email</Label>
        <Input
          id="parentEmail"
          type="email"
          value={parentEmail}
          onChange={(e) => setParentEmail(e.target.value)}
          placeholder="parent@example.com"
        />
        <p className="text-xs text-muted-foreground">
          If a parent manages your account, add their email here. They can sign in and view your bookings and credits.
        </p>
      </div>

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save changes
      </Button>
    </form>
    </div>
  )
}
