"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateProfile, type ClientProfile } from "@/app/actions/profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"

export function ProfileForm({ profile }: { profile: ClientProfile }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone)
  const [goals, setGoals] = useState(profile.goals)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateProfile({
        recordId: profile.recordId,
        name,
        phone,
        goals,
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

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save changes
      </Button>
    </form>
  )
}
