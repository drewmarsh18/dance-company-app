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
import { LogOut, Link as LinkIcon, Unlink } from "lucide-react"
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
