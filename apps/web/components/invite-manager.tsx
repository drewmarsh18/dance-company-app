"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  invitePrepMaster,
  revokeInvite,
  type Invite,
} from "@/app/actions/invites"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, UserPlus, X } from "lucide-react"

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "accepted"
      ? "default"
      : status === "revoked"
        ? "outline"
        : "secondary"
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  )
}

export function InviteManager({ initialInvites }: { initialInvites: Invite[] }) {
  const [invites, setInvites] = useState(initialInvites)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await invitePrepMaster({ email, name })
      if (result.ok) {
        toast.success(`Invited ${email}`)
        setEmail("")
        setName("")
        // Optimistically reflect the new invite; statuses sync on next load.
        setInvites((prev) => {
          const existing = prev.find(
            (i) => i.email === email.trim().toLowerCase(),
          )
          if (existing) {
            return prev.map((i) =>
              i.id === existing.id ? { ...i, status: "pending" } : i,
            )
          }
          return [
            {
              id: `temp-${Date.now()}`,
              email: email.trim().toLowerCase(),
              name: name.trim() || null,
              status: "pending",
              createdAt: new Date().toISOString(),
              acceptedAt: null,
            },
            ...prev,
          ]
        })
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleRevoke(invite: Invite) {
    startTransition(async () => {
      const result = await revokeInvite(invite.id)
      if (result.ok) {
        toast.success(`Revoked access for ${invite.email}`)
        setInvites((prev) =>
          prev.map((i) =>
            i.id === invite.id ? { ...i, status: "revoked" } : i,
          ),
        )
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Invite a PrepMaster
          </CardTitle>
          <CardDescription>
            Enter the Google email the PrepMaster will sign in with. They will
            only see their own appointments — never any pricing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleInvite}
            className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="coach@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-name">Name (optional)</Label>
              <Input
                id="invite-name"
                placeholder="Jordan Lee"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending..." : "Send invite"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PrepMasters</CardTitle>
          <CardDescription>
            {invites.length === 0
              ? "No PrepMasters invited yet."
              : `${invites.length} invited`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-4 px-6 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <Mail className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {invite.name || invite.email}
                    </p>
                    {invite.name ? (
                      <p className="truncate text-sm text-muted-foreground">
                        {invite.email}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={invite.status} />
                  {invite.status !== "revoked" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Revoke access for ${invite.email}`}
                      disabled={isPending}
                      onClick={() => handleRevoke(invite)}
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
