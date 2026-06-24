"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { updatePrepMaster } from "@/app/actions/admin"
import type { AdminWorker, AdminBooking } from "@/lib/airtable"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Users, DollarSign, Phone, Mail, MapPin, Home, CalendarDays, ChevronDown, ChevronUp } from "lucide-react"
import { BookingFilterBar, applyFilters, type SortDir } from "@/components/booking-filter-bar"

type Props = {
  workers: AdminWorker[]
  bookings: AdminBooking[]
  query: string
}

export function AdminPrepMastersPanel({ workers, bookings, query }: Props) {
  const [selected, setSelected] = useState<AdminWorker | null>(null)

  const filtered = query.trim()
    ? workers.filter((w) => w.name.toLowerCase().includes(query.toLowerCase()))
    : workers

  if (workers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Users className="size-10 text-muted-foreground" />
          <p className="font-medium">No Prep Masters found</p>
          <p className="text-sm text-muted-foreground">
            Add Prep Masters to the Workers table in Airtable to manage them here.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (selected) {
    return (
      <PrepMasterProfile
        worker={selected}
        bookings={bookings.filter((b) => b.prepMasterName === selected.name)}
        onBack={() => setSelected(null)}
        onSaved={(updated) => setSelected(updated)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">No Prep Masters match &ldquo;{query}&rdquo;.</p>
      )}
      {filtered.map((worker) => {
        const sessionCount = bookings.filter(
          (b) => b.prepMasterName === worker.name && b.status.toLowerCase() !== "cancelled",
        ).length
        return (
          <Card
            key={worker.id}
            className="cursor-pointer transition-colors hover:border-primary/40"
            onClick={() => setSelected(worker)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-base">{worker.name}</CardTitle>
                  <CardDescription>
                    {worker.email}
                    {worker.region ? ` · ${worker.region}` : ""}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold">${worker.hourlyRate.toFixed(2)}/session</p>
                    <p className="text-xs text-muted-foreground">{sessionCount} session{sessionCount === 1 ? "" : "s"}</p>
                  </div>
                  <Badge variant="outline" className={worker.active ? "border-green-300 bg-green-100 text-green-700" : "border-gray-200 bg-gray-100 text-gray-500"}>
                    {worker.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>
        )
      })}
    </div>
  )
}

function Field({
  label,
  icon,
  value,
  type = "text",
  onChange,
}: {
  label: string
  icon: React.ReactNode
  value: string
  type?: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  )
}

function PrepMasterProfile({
  worker,
  bookings,
  onBack,
  onSaved,
}: {
  worker: AdminWorker
  bookings: AdminBooking[]
  onBack: () => void
  onSaved: (w: AdminWorker) => void
}) {
  const [name, setName] = useState(worker.name)
  const [email, setEmail] = useState(worker.email)
  const [phone, setPhone] = useState(worker.phone)
  const [region, setRegion] = useState(worker.region)
  const [address, setAddress] = useState(worker.address)
  const [hourlyRate, setHourlyRate] = useState(String(worker.hourlyRate))
  const [active, setActive] = useState(worker.active)
  const [isPending, startTransition] = useTransition()

  const completedBookings = bookings.filter((b) => b.status.toLowerCase() !== "cancelled")

  function handleSave() {
    startTransition(async () => {
      const rate = parseFloat(hourlyRate)
      if (Number.isNaN(rate) || rate < 0) {
        toast.error("Hourly rate must be a valid number.")
        return
      }
      const result = await updatePrepMaster(worker.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        region: region.trim(),
        address: address.trim(),
        hourlyRate: rate,
        active,
      })
      if (result.ok) {
        toast.success("Prep Master updated.")
        onSaved({ ...worker, name: name.trim(), email: email.trim(), phone: phone.trim(), region: region.trim(), address: address.trim(), hourlyRate: rate, active })
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-4" />
          All Prep Masters
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>{worker.name}</CardTitle>
              <CardDescription>Edit Prep Master profile, pay rate, and status</CardDescription>
            </div>
            <Badge variant="outline" className={active ? "border-green-300 bg-green-100 text-green-700" : "border-gray-200 bg-gray-100 text-gray-500"}>{active ? "Active" : "Inactive"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" icon={<Users className="size-3.5" />} value={name} onChange={setName} />
            <Field label="Email" icon={<Mail className="size-3.5" />} value={email} onChange={setEmail} type="email" />
            <Field label="Phone" icon={<Phone className="size-3.5" />} value={phone} onChange={setPhone} type="tel" />
            <Field label="Region" icon={<MapPin className="size-3.5" />} value={region} onChange={setRegion} />
            <Field label="Address" icon={<Home className="size-3.5" />} value={address} onChange={setAddress} />
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <DollarSign className="size-3.5" />
                Pay rate per session ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <input
              id="active-toggle"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            <label htmlFor="active-toggle" className="text-sm font-medium cursor-pointer">
              Active — visible to dancers for booking
            </label>
          </div>

          <div className="flex gap-2">
            <Button disabled={isPending} onClick={handleSave}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button variant="ghost" onClick={onBack}>Cancel</Button>
          </div>
        </CardContent>
      </Card>

      {/* Booking history */}
      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
          <CalendarDays className="size-4 text-muted-foreground" />
          Booking history ({bookings.length})
        </h3>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
              <StatTile label="Total bookings" value={String(bookings.length)} />
              <StatTile label="Completed" value={String(completedBookings.length)} />
              <StatTile label="Total pay owed" value={`$${(completedBookings.length * worker.hourlyRate).toFixed(2)}`} highlight />
            </div>
            <Separator />
            <BookingHistoryList bookings={bookings} />
          </div>
        )}
      </div>
    </div>
  )
}

function BookingHistoryList({ bookings }: { bookings: AdminBooking[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [monthKey, setMonthKey] = useState("")
  const [sort, setSort] = useState<SortDir>("desc")

  const visible = applyFilters(bookings, monthKey, sort)

  return (
    <div className="flex flex-col gap-2">
      <BookingFilterBar
        bookings={bookings}
        monthKey={monthKey}
        sort={sort}
        onMonthChange={setMonthKey}
        onSortChange={setSort}
      />
      {visible.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">No bookings match the selected filter.</p>
      )}
    <ul className="flex flex-col gap-1.5">
      {visible.map((b) => {
        const isCancelled = b.status.toLowerCase() === "cancelled"
        const isOpen = expanded === b.id
        const statusVariant =
          b.status.toLowerCase() === "confirmed"
            ? "default"
            : isCancelled
              ? "destructive"
              : "secondary"

        return (
          <li key={b.id} className="rounded-md border text-sm overflow-hidden">
            <button
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : b.id)}
            >
              <div className="min-w-0">
                <span className="font-medium">{b.dancerName || b.clientEmail || "Client"}</span>
                <span className="ml-2 text-muted-foreground">
                  {b.date}{b.time ? ` · ${b.time}` : ""}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={statusVariant} className="capitalize">{b.status}</Badge>
                {isOpen ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t bg-muted/30 px-3 py-3 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Dancer</span>
                    <p className="font-medium">{b.dancerName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Email</span>
                    <p className="font-medium break-all">{b.clientEmail || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Date</span>
                    <p className="font-medium">{b.date || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Time</span>
                    <p className="font-medium">{b.time || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <p className="font-medium capitalize">{b.status}</p>
                  </div>
                </div>
                {b.notes && (
                  <div className="mt-1 rounded-md bg-background border px-3 py-2">
                    <span className="text-xs text-muted-foreground">Notes</span>
                    <p className="mt-0.5 text-sm">{b.notes}</p>
                  </div>
                )}
                {!b.notes && (
                  <p className="text-xs text-muted-foreground italic">No notes on this booking.</p>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
    </div>
  )
}

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-primary/30 bg-primary/5" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  )
}
