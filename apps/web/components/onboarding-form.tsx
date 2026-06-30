"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateProfile } from "@/app/actions/profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export function OnboardingForm({ recordId }: { recordId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [phone, setPhone] = useState("")
  const [goals, setGoals] = useState("")
  const [parentEmail, setParentEmail] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await updateProfile({
        recordId,
        name: "",
        phone: phone.trim(),
        goals: goals.trim(),
        parentEmail: parentEmail.trim() || undefined,
      })
      router.replace("/dashboard")
    })
  }

  function handleSkip() {
    router.replace("/dashboard")
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone number</Label>
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
              rows={3}
              placeholder="e.g. Improve turns, prepare for college auditions…"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="parentEmail">Parent email <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="parentEmail"
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="parent@example.com"
            />
            <p className="text-xs text-muted-foreground">
              If a parent manages your bookings, add their email here. They can sign in and view your account.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Get started
            </Button>
            <Button type="button" variant="ghost" disabled={isPending} onClick={handleSkip}>
              Skip for now
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
