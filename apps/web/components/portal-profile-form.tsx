"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { GoogleCalendarButton } from "@/components/google-calendar-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { LogOut, Link as LinkIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"

const UNIVERSITIES = [
  "Alabama","Arizona","ASU","Boise","Cincinnati","Coastal Carolina","CSU","CU Boulder",
  "ECU","Florida","FSU","GCU","Indiana","Iowa State","Kansas State","Kansas University",
  "Kentucky","Louisville","LSU Tiger Girls","Mississippi State","NC State","Ole Miss",
  "Ohio State Club Team","Oklahoma","Oregon","Penn State","Pitt","Purdue","Samford",
  "Sam Houston State","SDSU","South Carolina","TCU","Tennessee","Texas State","U Miami",
  "UCLA","UCSB","UK","UNLV","Utah","Vanderbilt","Virginia Tech","Washington",
  "Western Michigan","Wisconsin","WVU","Wichita State",
]

type Props = {
  initialPhone: string
  initialAddress: string
  initialUniversity: string
  calendarConnected: boolean
  isGoogleLinked: boolean
}

export function PortalProfileForm({
  initialPhone, initialAddress, initialUniversity, calendarConnected, isGoogleLinked,
}: Props) {
  const router = useRouter()
  const [phone, setPhone] = useState(initialPhone)
  const [address, setAddress] = useState(initialAddress)
  const [university, setUniversity] = useState(initialUniversity)
  const [uniSearch, setUniSearch] = useState(initialUniversity)
  const [uniOpen, setUniOpen] = useState(false)
  const [saving, setSaving] = useState<"phone" | "address" | "university" | null>(null)
  const [googleLinked, setGoogleLinked] = useState(isGoogleLinked)
  const [googleLinking, setGoogleLinking] = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try { return localStorage.getItem("pm-google-nudge-dismissed") === "1" } catch { return false }
  })

  const filteredUnis = UNIVERSITIES.filter((u) =>
    u.toLowerCase().includes(uniSearch.toLowerCase())
  )

  async function saveField(field: "phone" | "address" | "university", value: string) {
    setSaving(field)
    const res = await fetch("/api/portal/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    })
    setSaving(null)
    if (res.ok) toast.success("Saved")
    else toast.error("Failed to save")
  }

  function dismissNudge() {
    try { localStorage.setItem("pm-google-nudge-dismissed", "1") } catch {}
    setNudgeDismissed(true)
  }

  async function handleConnectGoogle() {
    setGoogleLinking(true)
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: window.location.href })
    } catch {
      toast.error("Could not connect Google account.")
    } finally {
      setGoogleLinking(false)
    }
  }

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Google nudge banner — shown to PMs who haven't linked Google yet */}
      {!googleLinked && !nudgeDismissed && (
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
          <Button size="sm" variant="secondary" onClick={handleConnectGoogle} disabled={googleLinking} className="shrink-0 text-xs font-semibold">
            {googleLinking ? "Connecting…" : "Link Google"}
          </Button>
          <button
            onClick={dismissNudge}
            className="absolute right-3 top-3 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your details</CardTitle>
          <CardDescription>This information is shown to members when they book with you.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-phone">Phone</Label>
            <div className="flex gap-2">
              <Input
                id="pm-phone"
                type="tel"
                placeholder="(555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                disabled={saving === "phone" || phone === initialPhone}
                onClick={() => saveField("phone", phone)}
              >
                {saving === "phone" ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-address">Location / Address</Label>
            <div className="flex gap-2">
              <Input
                id="pm-address"
                placeholder="City, State"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                disabled={saving === "address" || address === initialAddress}
                onClick={() => saveField("address", address)}
              >
                {saving === "address" ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>University / Program</Label>
            <div className="relative">
              <Input
                placeholder="Search universities…"
                value={uniSearch}
                onChange={(e) => { setUniSearch(e.target.value); setUniOpen(true) }}
                onFocus={() => setUniOpen(true)}
                onBlur={() => setTimeout(() => setUniOpen(false), 150)}
              />
              {uniOpen && filteredUnis.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {filteredUnis.map((u) => (
                    <button key={u}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setUniversity(u); setUniSearch(u); setUniOpen(false)
                        saveField("university", u)
                      }}
                      className={cn(
                        "flex w-full items-center px-3 py-2 text-sm hover:bg-muted transition-colors text-left",
                        university === u && "bg-primary/10 text-primary font-medium"
                      )}>
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {university && <p className="text-xs text-muted-foreground">Current: <strong>{university}</strong></p>}
          </div>
        </CardContent>
      </Card>

      {/* Connected accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected accounts</CardTitle>
          <CardDescription>Link external services to enhance your experience.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Google account */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Google account</p>
              <p className="text-xs text-muted-foreground">
                {googleLinked ? "Your Google account is linked — sign in with Google." : "Link your Google account to enable Google sign-in."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={googleLinking}
              onClick={handleConnectGoogle}
              className={cn("gap-2", googleLinked && "border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-400")}
            >
              {googleLinked ? <><LinkIcon className="size-4" /> Google linked</> : <><LinkIcon className="size-4" /> {googleLinking ? "Connecting…" : "Link Google"}</>}
            </Button>
          </div>

          {/* Google Calendar */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Google Calendar</p>
              <p className="text-xs text-muted-foreground">
                {calendarConnected
                  ? "Your sessions automatically sync to your Google Calendar."
                  : "Sync your CDP sessions to Google Calendar and see all your events in one place."}
              </p>
            </div>
            <GoogleCalendarButton connected={calendarConnected} />
          </div>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Card className="border-destructive/30">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="text-sm font-medium">Sign out</p>
            <p className="text-xs text-muted-foreground">You'll be returned to the login screen.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
