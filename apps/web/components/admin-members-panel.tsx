"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { addComplimentaryCredits, adminAssignPlan, createMember, adminRemovePlan, adminSetCredits } from "@/app/actions/admin"
import type { AdminMember, AdminBooking, MemberPlan } from "@/lib/airtable"
import { SESSION_TYPE_LABELS } from "@/lib/session-types"
import { planDisplayStatus } from "@/lib/plan-utils"
import type { DancePackage } from "@/lib/packages"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ChevronDown,
  ChevronUp,
  PlusCircle,
  User,
  CalendarDays,
  Ticket,
  Package,
  Trash2,
  X,
} from "lucide-react"
import { Label } from "@/components/ui/label"

type Props = {
  members: AdminMember[]
  bookings: AdminBooking[]
  plans: MemberPlan[]
  packages: DancePackage[]
  query?: string
}

export function AdminMembersPanel({ members, bookings, plans, packages, query = "" }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [localMembers, setLocalMembers] = useState<AdminMember[]>(members)

  const filtered = query.trim()
    ? localMembers.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()) || m.email.toLowerCase().includes(query.toLowerCase()))
    : localMembers
  const [selectedPackage, setSelectedPackage] = useState<Record<string, string>>({})
  const [localCredits, setLocalCredits] = useState<Record<string, number>>({})
  const [editingCredits, setEditingCredits] = useState<Record<string, string>>({})
  const [localPlans, setLocalPlans] = useState<MemberPlan[]>(plans)
  const [isPending, startTransition] = useTransition()

  function memberBookings(member: AdminMember) {
    return bookings.filter(
      (b) =>
        b.userId === member.userId ||
        b.clientEmail.toLowerCase() === member.email.toLowerCase(),
    )
  }

  function memberPlans(member: AdminMember) {
    return localPlans.filter((p) => p.userId === member.userId)
  }

  function creditsFor(member: AdminMember) {
    return localCredits[member.id] ?? member.creditsRemaining
  }

  function memberStatus(member: AdminMember) {
    const credits = creditsFor(member)
    const plans = memberPlans(member)
    const activePlan = plans.find((p) => planDisplayStatus(p) === "Active")
    if (credits > 0 || activePlan) return "active"
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
    const recentBooking = memberBookings(member).some(
      (b) => b.status.toLowerCase() !== "cancelled" && new Date(b.date).getTime() >= oneYearAgo,
    )
    const recentPlan = plans.some((p) => new Date(p.purchasedAt).getTime() >= oneYearAgo)
    if (recentBooking || recentPlan) return "active"
    if (memberBookings(member).length === 0 && plans.length === 0) return "lead"
    return "inactive"
  }

  function handleAddCredits(member: AdminMember, label: string) {
    startTransition(async () => {
      const result = await addComplimentaryCredits(
        { id: member.id, userId: member.userId, email: member.email, creditsRemaining: creditsFor(member) },
        label,
      )
      if (result.ok) {
        setLocalPlans((prev) => [result.plan, ...prev])
        setLocalCredits((prev) => ({ ...prev, [member.id]: creditsFor(member) + 1 }))
        toast.success(`Added ${label} single session to ${member.name || member.email}.`)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleSetCredits(member: AdminMember) {
    const val = parseInt(editingCredits[member.id] ?? "", 10)
    if (Number.isNaN(val) || val < 0) { toast.error("Enter a valid number."); return }
    startTransition(async () => {
      const result = await adminSetCredits(member.id, val)
      if (result.ok) {
        setLocalCredits((prev) => ({ ...prev, [member.id]: val }))
        setEditingCredits((prev) => ({ ...prev, [member.id]: "" }))
        toast.success(`Credits updated to ${val}.`)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleRemovePlan(member: AdminMember, plan: MemberPlan) {
    if (!confirm(`Remove "${plan.planName}" from ${member.name || member.email}? This will deduct ${plan.sessions} credits.`)) return
    startTransition(async () => {
      const result = await adminRemovePlan(plan.id, member.id, plan.sessions, creditsFor(member))
      if (result.ok) {
        setLocalPlans((prev) => prev.filter((p) => p.id !== plan.id))
        setLocalCredits((prev) => ({ ...prev, [member.id]: Math.max(0, creditsFor(member) - plan.sessions) }))
        toast.success(`Removed "${plan.planName}" from ${member.name || member.email}.`)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleAssignPlan(member: AdminMember) {
    const packageId = selectedPackage[member.id]
    if (!packageId) {
      toast.error("Select a package first.")
      return
    }
    const pkg = packages.find((p) => p.id === packageId)
    if (!pkg) return

    startTransition(async () => {
      const result = await adminAssignPlan(
        { id: member.id, userId: member.userId, email: member.email, creditsRemaining: creditsFor(member) },
        packageId,
      )
      if (result.ok) {
        setLocalPlans((prev) => [result.plan, ...prev])
        setLocalCredits((prev) => ({ ...prev, [member.id]: creditsFor(member) + pkg.sessions }))
        setSelectedPackage((prev) => ({ ...prev, [member.id]: "" }))
        toast.success(`Assigned ${pkg.name} to ${member.name || member.email}.`)
      } else {
        toast.error(result.error)
      }
    })
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <User className="size-10 text-muted-foreground" />
          <p className="font-medium">No members yet</p>
          <p className="text-sm text-muted-foreground">Members will appear here once they sign up.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAddForm((v) => !v)} variant={showAddForm ? "outline" : "default"}>
          {showAddForm ? <><X className="mr-1.5 size-3.5" />Cancel</> : <><PlusCircle className="mr-1.5 size-3.5" />Add member</>}
        </Button>
      </div>

      {showAddForm && (
        <AddMemberForm
          onSuccess={(member) => {
            setLocalMembers((prev) => [member, ...prev])
            setShowAddForm(false)
          }}
        />
      )}

      {filtered.length === 0 && !showAddForm && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {query ? <>No members match &ldquo;{query}&rdquo;.</> : "No members yet."}
        </p>
      )}
      {filtered.map((member) => {
        const isOpen = expanded === member.id
        const history = memberBookings(member)
        const memberPlanList = memberPlans(member)
        const activePlan = memberPlanList.find((p) => planDisplayStatus(p) === "Active")
        const credits = creditsFor(member)
        const status = memberStatus(member)

        return (
          <Card key={member.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                    {(member.name || member.email)[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base">{member.name || "—"}</CardTitle>
                    <CardDescription className="truncate">{member.email}</CardDescription>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      status === "active"
                        ? "border-green-300 bg-green-100 text-green-700"
                        : status === "lead"
                          ? "border-blue-300 bg-blue-100 text-blue-700"
                          : "border-gray-200 bg-gray-100 text-gray-500"
                    }
                  >
                    {status === "active" ? "Active" : status === "lead" ? "Lead" : "Inactive"}
                  </Badge>
                  {activePlan && (
                    <Badge variant="default" className="gap-1 hidden sm:flex">
                      <Package className="size-3" />
                      {activePlan.planName}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="gap-1">
                    <Ticket className="size-3" />
                    {credits}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                    onClick={() => setExpanded(isOpen ? null : member.id)}
                  >
                    {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isOpen && (
              <CardContent className="flex flex-col gap-5 pt-0">
                <Separator />

                {/* Profile info */}
                {(member.phone || member.goals) && (
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    {member.phone && (
                      <div>
                        <span className="text-muted-foreground">Phone </span>
                        <span className="font-medium">{member.phone}</span>
                      </div>
                    )}
                    {member.goals && (
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">Goals </span>
                        <span className="font-medium">{member.goals}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Assign a plan */}
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Package className="size-4 text-muted-foreground" />
                    Assign a plan
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={selectedPackage[member.id] ?? ""}
                      onChange={(e) =>
                        setSelectedPackage((prev) => ({ ...prev, [member.id]: e.target.value }))
                      }
                    >
                      <option value="">Select package…</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} — {pkg.sessions} sessions (${pkg.price})
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      disabled={isPending || !selectedPackage[member.id]}
                      onClick={() => handleAssignPlan(member)}
                    >
                      Assign
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Assigning a plan adds its sessions as credits to the member's account.
  </p>
                </div>

                {/* Plan history + single sessions */}
                {memberPlanList.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">
                      Plan history ({memberPlanList.length})
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {memberPlanList.map((plan) => {
                        const purchaseDate = plan.purchasedAt
                          ? new Date(plan.purchasedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : null
                        const expiryDate = plan.expiresAt
                          ? new Date(plan.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : null
                        const planStatus = planDisplayStatus(plan)
                        const activeSingleCount = memberPlanList.filter(
                          (p) => planDisplayStatus(p) === "Active" && p.sessions === 1
                        ).length
                        const displayCount = planStatus !== "Active"
                          ? plan.sessions
                          : plan.sessions === 1
                            ? 1
                            : Math.max(0, creditsFor(member) - activeSingleCount)
                        return (
                          <li
                            key={plan.id}
                            className="flex flex-col gap-1 rounded-md border px-3 py-2 text-sm"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <Package className="size-3.5 shrink-0 text-primary" />
                                <span className="font-medium">{plan.planName}</span>
                                <span className="text-muted-foreground">
                                  {displayCount} {displayCount === 1 ? "credit" : "credits"} · ${plan.pricePaid}
                                  {purchaseDate ? ` · ${purchaseDate}` : ""}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`capitalize text-xs ${planStatus === "Active" ? "border-green-300 bg-green-100 text-green-700" : planStatus === "Used" ? "border-amber-300 bg-amber-100 text-amber-700" : "border-gray-200 bg-gray-100 text-gray-500"}`}
                                >
                                  {planStatus}
                                </Badge>
                                {planStatus !== "Used" && (
                                  <button
                                    disabled={isPending}
                                    onClick={() => handleRemovePlan(member, plan)}
                                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                                    aria-label="Remove plan"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {expiryDate && (
                              <p className="pl-5 text-xs text-muted-foreground">
                                Expires {expiryDate}
                              </p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {/* Add single session */}
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Add single session</p>
                  <div className="flex flex-wrap gap-2">
                    {(["60 min", "45 min", "30 min"] as const).map((label) => (
                      <Button
                        key={label}
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleAddCredits(member, label)}
                      >
                        <PlusCircle className="mr-1.5 size-4" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Edit credit balance */}
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Set credit balance</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      placeholder={String(credits)}
                      value={editingCredits[member.id] ?? ""}
                      onChange={(e) => setEditingCredits((prev) => ({ ...prev, [member.id]: e.target.value }))}
                      className="h-8 w-24 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending || !editingCredits[member.id]}
                      onClick={() => handleSetCredits(member)}
                    >
                      Save
                    </Button>
                    <span className="text-xs text-muted-foreground">Current: {credits}</span>
                  </div>
                </div>

                {/* Booking history */}
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    Booking history ({history.length})
                  </p>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No bookings yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {history.map((b) => {
                        const statusVariant =
                          b.status.toLowerCase() === "confirmed"
                            ? "default"
                            : b.status.toLowerCase() === "cancelled"
                              ? "destructive"
                              : "secondary"
                        return (
                          <li
                            key={b.id}
                            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <span className="font-medium">{b.prepMasterName || "Prep Master"}</span>
                              <span className="ml-2 text-muted-foreground">
                                {b.date}{b.time ? ` · ${b.time}` : ""}
                              </span>
                              {b.sessionType && (
                                <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${b.sessionType === "pack-hour" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"}`}>
                                  {SESSION_TYPE_LABELS[b.sessionType as import("@/lib/session-types").SessionType]}
                                </span>
                              )}
                            </div>
                            <Badge variant={statusVariant} className="capitalize shrink-0">
                              {b.status}
                            </Badge>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function AddMemberForm({ onSuccess }: { onSuccess: (member: AdminMember) => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [goals, setGoals] = useState("")
  const [credits, setCredits] = useState("0")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createMember({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        goals: goals.trim(),
        creditsRemaining: Math.max(0, parseInt(credits, 10) || 0),
      })
      if (result.ok) {
        toast.success(`${name.trim() || email.trim()} has been added.`)
        onSuccess(result.member)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PlusCircle className="size-4 text-primary" />
          Add new member
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Creates a member record in Airtable. They&apos;ll be linked to this record automatically when they sign in with the same email.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-member-name">Full name <span className="text-destructive">*</span></Label>
              <Input id="new-member-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-member-email">Email <span className="text-destructive">*</span></Label>
              <Input id="new-member-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-member-phone">Phone</Label>
              <Input id="new-member-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-member-credits">Starting credits</Label>
              <Input id="new-member-credits" type="number" min="0" value={credits} onChange={(e) => setCredits(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="new-member-goals">Goals</Label>
              <Input id="new-member-goals" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="e.g. Improve turns, prepare for auditions…" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add member"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
