import "server-only"

// Airtable backend client — single base ("CDP Payroll", AIRTABLE_BASE_ID).
//  - Workers  -> prep master roster. Holds "Hourly Rate", which is NEVER
//                returned to the app (not to dancers, not to prep masters).
//  - Members  -> dancer / client profiles.
//  - Bookings -> session reservations. Contains NO pricing.
// Auth (users/sessions) lives in Neon via Better Auth.

const AIRTABLE_API_URL = "https://api.airtable.com/v0"
const BASE_ID = process.env.AIRTABLE_BASE_ID
const API_KEY = process.env.AIRTABLE_API_KEY

export const TABLES = {
  workers: "Workers",
  clients: "Members",
  bookings: "Bookings",
  plans: "Plans",
} as const

/** Whether Airtable is configured. UI shows a setup notice when false. */
export function isAirtableConfigured() {
  return Boolean(BASE_ID && API_KEY)
}

// --- Record types ------------------------------------------------------------

export type AirtableRecord<T> = {
  id: string
  createdTime: string
  fields: T
}

// NOTE: "Hourly Rate" is part of this type for internal/admin use only. It must
// NEVER be surfaced to the UI — toPrepMaster() deliberately omits it.
export type WorkerFields = {
  "Full Name"?: string
  "Worker ID"?: string
  Email?: string
  Phone?: string
  Region?: string
  University?: string
  Address?: string
  "Hourly Rate"?: number
  Active?: boolean
}

export type ClientFields = {
  Name?: string
  Email?: string
  "User ID"?: string
  Phone?: string
  Goals?: string
  "Credits Remaining"?: number
  "Comp Credits"?: string // JSON: [{label: string, grantedAt: string}]
}

export type { SessionType } from "@/lib/session-types"
export { SESSION_TYPE_LABELS } from "@/lib/session-types"
import type { SessionType } from "@/lib/session-types"

export type BookingFields = {
  Name?: string
  "Client Email"?: string
  "User ID"?: string
  "Prep Master Name"?: string
  Date?: string
  Time?: string
  Status?: string
  Notes?: string
  "Session Type"?: string
}

export type PlanFields = {
  "User ID"?: string
  "Member Email"?: string
  "Plan Name"?: string
  Sessions?: number
  "Price Paid"?: number
  "Purchased At"?: string
  "Expires At"?: string
  Status?: string
}

export type MemberPlan = {
  id: string
  userId: string
  planName: string
  sessions: number
  pricePaid: number
  purchasedAt: string
  expiresAt: string
  status: string
}


// --- Low-level fetch helpers -------------------------------------------------

type ListOptions = {
  filterByFormula?: string
  maxRecords?: number
  sort?: { field: string; direction?: "asc" | "desc" }[]
  revalidate?: number
}

async function airtableFetch(
  path: string,
  init?: RequestInit & { revalidate?: number },
) {
  if (!BASE_ID || !API_KEY) {
    throw new Error(
      "Airtable is not configured. Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID.",
    )
  }
  const { revalidate, ...rest } = init ?? {}
  const cacheOpt =
    revalidate === 0
      ? { cache: "no-store" as const }
      : revalidate !== undefined
        ? { next: { revalidate } }
        : {}
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Airtable request timed out after 8s")), 8000),
  )
  const res = await Promise.race([
    fetch(`${AIRTABLE_API_URL}/${BASE_ID}/${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        ...(rest.headers ?? {}),
      },
      ...cacheOpt,
    }),
    timeout,
  ])
  if (!res.ok) {
    throw new Error(`Airtable request failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

async function list<T>(table: string, options: ListOptions = {}): Promise<AirtableRecord<T>[]> {
  const params = new URLSearchParams()
  if (options.filterByFormula) params.set("filterByFormula", options.filterByFormula)
  if (options.maxRecords) params.set("maxRecords", String(options.maxRecords))
  options.sort?.forEach((s, i) => {
    params.set(`sort[${i}][field]`, s.field)
    if (s.direction) params.set(`sort[${i}][direction]`, s.direction)
  })
  const query = params.toString()
  const data = await airtableFetch(
    `${encodeURIComponent(table)}${query ? `?${query}` : ""}`,
    { method: "GET", revalidate: options.revalidate ?? 15 },
  )
  return data.records ?? []
}

async function create<T>(table: string, fields: Partial<T>): Promise<AirtableRecord<T>> {
  // typecast lets Airtable create new single-select options (e.g. Status) on write.
  return airtableFetch(encodeURIComponent(table), {
    method: "POST",
    body: JSON.stringify({ fields, typecast: true }),
  })
}

async function update<T>(
  table: string,
  id: string,
  fields: Partial<T>,
): Promise<AirtableRecord<T>> {
  return airtableFetch(`${encodeURIComponent(table)}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields, typecast: true }),
  })
}

async function get<T>(table: string, id: string): Promise<AirtableRecord<T>> {
  return airtableFetch(`${encodeURIComponent(table)}/${id}`, {
    method: "GET",
    revalidate: 30,
  })
}

async function destroy(table: string, id: string): Promise<void> {
  await airtableFetch(`${encodeURIComponent(table)}/${id}`, { method: "DELETE" })
}

// Exposed so server actions can read/write the app tables directly.
export const appBase = { list, create, update, get, destroy }

// --- Prep Masters (from the Workers table) -----------------------------------

// What the app exposes for a prep master. Deliberately omits Hourly Rate and
// every other payroll/sensitive field.
export type PrepMaster = {
  id: string
  name: string
  email: string
  region: string
  university: string
}

function toPrepMaster(r: AirtableRecord<WorkerFields>): PrepMaster {
  return {
    id: r.id,
    name: r.fields["Full Name"] ?? "Unnamed Prep Master",
    email: r.fields.Email ?? "",
    region: r.fields.Region ?? "",
    university: r.fields.University ?? "",
    // Hourly Rate is intentionally NOT included here.
  }
}

export async function getPrepMasters(): Promise<PrepMaster[]> {
  const records = await list<WorkerFields>(TABLES.workers, {
    sort: [{ field: "Full Name", direction: "asc" }],
    revalidate: 30,
  })
  return records.filter((r) => r.fields.Active !== false).map(toPrepMaster)
}

export async function getPrepMaster(id: string): Promise<PrepMaster | null> {
  try {
    return toPrepMaster(await get<WorkerFields>(TABLES.workers, id))
  } catch {
    return null
  }
}

export async function getPrepMasterPhone(id: string): Promise<string | null> {
  try {
    const record = await get<WorkerFields>(TABLES.workers, id)
    return record.fields.Phone ?? null
  } catch {
    return null
  }
}

export async function getPrepMasterByEmail(email: string): Promise<PrepMaster | null> {
  const safe = email.trim().toLowerCase().replace(/'/g, "\\'")
  const records = await list<WorkerFields>(TABLES.workers, {
    filterByFormula: `LOWER({Email}) = '${safe}'`,
    maxRecords: 1,
  })
  return records[0] ? toPrepMaster(records[0]) : null
}

// --- Prep master portal: bookings + dancer contact (NO pricing) --------------

export type PrepMasterBooking = {
  id: string
  date: string
  time: string
  status: string
  notes: string
  dancerName: string
  dancerEmail: string
  dancerPhone: string
  userId: string
}

export async function getBookingsForPrepMaster(
  prepMasterName: string,
): Promise<PrepMasterBooking[]> {
  const safeName = prepMasterName.replace(/'/g, "\\'")
  const records = await list<BookingFields>(TABLES.bookings, {
    filterByFormula: `{Prep Master Name} = '${safeName}'`,
    sort: [{ field: "Date", direction: "asc" }],
  })

  const userIds = Array.from(
    new Set(records.map((r) => r.fields["User ID"]).filter(Boolean) as string[]),
  )
  const clientMap = await getClientsByUserIds(userIds)

  return records.map((r) => {
    const uid = r.fields["User ID"] ?? ""
    const client = clientMap.get(uid)
    return {
      id: r.id,
      date: r.fields.Date ?? "",
      time: r.fields.Time ?? "",
      status: r.fields.Status ?? "Pending",
      notes: r.fields.Notes ?? "",
      dancerName: client?.name ?? "",
      dancerEmail: client?.email ?? r.fields["Client Email"] ?? "",
      dancerPhone: client?.phone ?? "",
      userId: uid,
    }
  })
}

/**
 * Returns the booked time slots (display strings, e.g. "3:00 PM") for a prep
 * master on a specific date. Used to hide already-taken slots when booking.
 * Cancelled bookings are excluded so their slots free up again.
 */
export async function getBookedSlots(
  prepMasterName: string,
  dateIso: string,
): Promise<string[]> {
  const safeName = prepMasterName.replace(/'/g, "\\'")
  const safeDate = dateIso.replace(/'/g, "\\'")
  const records = await list<BookingFields>(TABLES.bookings, {
    filterByFormula: `AND({Prep Master Name} = '${safeName}', {Date} = '${safeDate}')`,
    revalidate: 5,
  })
  return records
    .filter((r) => (r.fields.Status ?? "").toLowerCase() !== "cancelled")
    .map((r) => r.fields.Time ?? "")
    .filter(Boolean)
}

/**
 * Returns a map of date (YYYY-MM-DD) -> booked time slots for a prep master,
 * across all their bookings. Used to grey out taken slots in the booking flow.
 */
export async function getUpcomingBookedSlots(
  prepMasterName: string,
): Promise<Record<string, string[]>> {
  const safeName = prepMasterName.replace(/'/g, "\\'")
  const records = await list<BookingFields>(TABLES.bookings, {
    filterByFormula: `{Prep Master Name} = '${safeName}'`,
    revalidate: 5,
  })
  const map: Record<string, string[]> = {}
  for (const r of records) {
    if ((r.fields.Status ?? "").toLowerCase() === "cancelled") continue
    const date = r.fields.Date
    const time = r.fields.Time
    if (!date || !time) continue
    ;(map[date] ??= []).push(time)
  }
  return map
}

// --- Member plans ------------------------------------------------------------

export async function getPlansForUser(userId: string): Promise<MemberPlan[]> {
  const safeId = userId.replace(/'/g, "\\'")
  const records = await list<PlanFields>(TABLES.plans, {
    filterByFormula: `{User ID} = '${safeId}'`,
    sort: [{ field: "Purchased At", direction: "desc" }],
    revalidate: 0,
  })
  return records.map((r) => ({
    id: r.id,
    userId: r.fields["User ID"] ?? "",
    planName: r.fields["Plan Name"] ?? "",
    sessions: r.fields.Sessions ?? 0,
    pricePaid: r.fields["Price Paid"] ?? 0,
    purchasedAt: r.fields["Purchased At"] ?? "",
    expiresAt: r.fields["Expires At"] ?? "",
    status: r.fields.Status ?? "Active",
  }))
}

export async function adminGetAllPlans(): Promise<MemberPlan[]> {
  const records = await list<PlanFields>(TABLES.plans, {
    sort: [{ field: "Purchased At", direction: "desc" }],
    revalidate: 0,
  })
  return records.map((r) => ({
    id: r.id,
    userId: r.fields["User ID"] ?? "",
    planName: r.fields["Plan Name"] ?? "",
    sessions: r.fields.Sessions ?? 0,
    pricePaid: r.fields["Price Paid"] ?? 0,
    purchasedAt: r.fields["Purchased At"] ?? "",
    expiresAt: r.fields["Expires At"] ?? "",
    status: r.fields.Status ?? "Active",
  }))
}

export async function getActivePlanForUser(userId: string): Promise<{ id: string } | null> {
  const safeId = userId.replace(/'/g, "\\'")
  const records = await list<PlanFields>(TABLES.plans, {
    filterByFormula: `AND({User ID} = '${safeId}', {Status} = 'Active')`,
    sort: [{ field: "Purchased At", direction: "desc" }],
    maxRecords: 1,
    revalidate: 0,
  })
  return records[0] ? { id: records[0].id } : null
}

export async function getMostRecentInactivePlanForUser(userId: string): Promise<{ id: string } | null> {
  const safeId = userId.replace(/'/g, "\\'")
  const records = await list<PlanFields>(TABLES.plans, {
    filterByFormula: `AND({User ID} = '${safeId}', {Status} = 'Used')`,
    sort: [{ field: "Purchased At", direction: "desc" }],
    maxRecords: 1,
    revalidate: 0,
  })
  return records[0] ? { id: records[0].id } : null
}

export async function setPlanStatus(planId: string, status: string): Promise<void> {
  await update<PlanFields>(TABLES.plans, planId, { Status: status })
}

export async function createMemberPlan(fields: {
  userId: string
  memberEmail: string
  planName: string
  sessions: number
  pricePaid: number
  expiryDays: number
}): Promise<MemberPlan> {
  const purchasedAt = new Date()
  const expiresAt = new Date(purchasedAt)
  expiresAt.setDate(expiresAt.getDate() + fields.expiryDays)
  const record = await create<PlanFields>(TABLES.plans, {
    "User ID": fields.userId,
    "Member Email": fields.memberEmail,
    "Plan Name": fields.planName,
    Sessions: fields.sessions,
    "Price Paid": fields.pricePaid,
    "Purchased At": purchasedAt.toISOString(),
    "Expires At": expiresAt.toISOString(),
    Status: "Active",
  })
  return {
    id: record.id,
    userId: record.fields["User ID"] ?? "",
    planName: record.fields["Plan Name"] ?? "",
    sessions: record.fields.Sessions ?? 0,
    pricePaid: record.fields["Price Paid"] ?? 0,
    purchasedAt: record.fields["Purchased At"] ?? "",
    expiresAt: record.fields["Expires At"] ?? "",
    status: record.fields.Status ?? "Active",
  }
}

// --- Admin-only helpers (never call from dancer/prep master code paths) ------

export type CompCredit = { label: string; grantedAt: string; usedAt?: string }

export type AdminMember = {
  id: string
  name: string
  email: string
  userId: string
  phone: string
  goals: string
  creditsRemaining: number
  compCredits: CompCredit[]
}

export type AdminWorker = {
  id: string
  name: string
  email: string
  region: string
  university: string
  phone: string
  address: string
  hourlyRate: number
  active: boolean
}

export type AdminBooking = {
  id: string
  clientEmail: string
  dancerName: string
  userId: string
  prepMasterName: string
  date: string
  time: string
  status: string
  notes: string
  sessionType: SessionType | null
}

export async function adminGetAllMembers(): Promise<AdminMember[]> {
  const records = await list<ClientFields>(TABLES.clients, {
    sort: [{ field: "Name", direction: "asc" }],
    revalidate: 0,
  })
  return records.map((r) => {
    let compCredits: CompCredit[] = []
    try { compCredits = JSON.parse(r.fields["Comp Credits"] ?? "[]") } catch {}
    return {
      id: r.id,
      name: r.fields.Name ?? "",
      email: r.fields.Email ?? "",
      userId: r.fields["User ID"] ?? "",
      phone: r.fields.Phone ?? "",
      goals: r.fields.Goals ?? "",
      creditsRemaining: r.fields["Credits Remaining"] ?? 0,
      compCredits,
    }
  })
}

export async function adminGetAllBookings(): Promise<AdminBooking[]> {
  const records = await list<BookingFields>(TABLES.bookings, {
    sort: [{ field: "Date", direction: "desc" }],
    revalidate: 0,
  })
  const userIds = Array.from(
    new Set(records.map((r) => r.fields["User ID"]).filter(Boolean) as string[]),
  )
  const clientMap = await getClientsByUserIds(userIds)
  return records.map((r) => {
    const uid = r.fields["User ID"] ?? ""
    const client = clientMap.get(uid)
    return {
      id: r.id,
      clientEmail: r.fields["Client Email"] ?? "",
      dancerName: client?.name ?? "",
      userId: uid,
      prepMasterName: r.fields["Prep Master Name"] ?? "",
      date: r.fields.Date ?? "",
      time: r.fields.Time ?? "",
      status: r.fields.Status ?? "Pending",
      notes: r.fields.Notes ?? "",
      sessionType: (r.fields["Session Type"] as SessionType) ?? null,
    }
  })
}

export async function adminCreateWorker(fields: {
  name: string
  email: string
  phone?: string
  region?: string
  address?: string
  hourlyRate?: number
}): Promise<AdminWorker> {
  const record = await create<WorkerFields>(TABLES.workers, {
    "Full Name": fields.name,
    Email: fields.email,
    Phone: fields.phone ?? "",
    Region: fields.region ?? "",
    Address: fields.address ?? "",
    "Hourly Rate": fields.hourlyRate ?? 0,
    Active: true,
  })
  return {
    id: record.id,
    name: record.fields["Full Name"] ?? "",
    email: record.fields.Email ?? "",
    region: record.fields.Region ?? "",
    phone: record.fields.Phone ?? "",
    address: record.fields.Address ?? "",
    hourlyRate: record.fields["Hourly Rate"] ?? 0,
    active: record.fields.Active !== false,
    university: record.fields.University ?? "",
  }
}

export async function adminGetAllWorkers(): Promise<AdminWorker[]> {
  const records = await list<WorkerFields>(TABLES.workers, {
    sort: [{ field: "Full Name", direction: "asc" }],
    revalidate: 0,
  })
  return records.map((r) => ({
    id: r.id,
    name: r.fields["Full Name"] ?? "",
    email: r.fields.Email ?? "",
    region: r.fields.Region ?? "",
    university: r.fields.University ?? "",
    phone: r.fields.Phone ?? "",
    address: r.fields.Address ?? "",
    hourlyRate: r.fields["Hourly Rate"] ?? 0,
    active: r.fields.Active !== false,
  }))
}

export async function adminUpdateWorker(
  workerId: string,
  fields: {
    name?: string
    email?: string
    phone?: string
    region?: string
    address?: string
    hourlyRate?: number
    active?: boolean
  },
): Promise<void> {
  const patch: Partial<WorkerFields> = {}
  if (fields.name !== undefined) patch["Full Name"] = fields.name
  if (fields.email !== undefined) patch.Email = fields.email
  if (fields.phone !== undefined) patch.Phone = fields.phone
  if (fields.region !== undefined) patch.Region = fields.region
  if (fields.address !== undefined) patch.Address = fields.address
  if (fields.hourlyRate !== undefined) patch["Hourly Rate"] = fields.hourlyRate
  if (fields.active !== undefined) patch.Active = fields.active
  await update<WorkerFields>(TABLES.workers, workerId, patch)
}

export async function adminAddCredits(
  memberId: string,
  currentCredits: number,
  creditsToAdd: number,
  compLabel?: string,
  existingCompCredits?: CompCredit[],
): Promise<void> {
  const fields: Partial<ClientFields> = { "Credits Remaining": currentCredits + creditsToAdd }
  if (compLabel) {
    const updated = [...(existingCompCredits ?? []), { label: compLabel, grantedAt: new Date().toISOString() }]
    fields["Comp Credits"] = JSON.stringify(updated)
  }
  await update<ClientFields>(TABLES.clients, memberId, fields)
}

export async function adminCreateMember(fields: {
  name: string
  email: string
  phone?: string
  goals?: string
  creditsRemaining?: number
}): Promise<AdminMember> {
  const record = await create<ClientFields>(TABLES.clients, {
    Name: fields.name,
    Email: fields.email,
    Phone: fields.phone ?? "",
    Goals: fields.goals ?? "",
    "Credits Remaining": fields.creditsRemaining ?? 0,
  })
  return {
    id: record.id,
    name: record.fields.Name ?? "",
    email: record.fields.Email ?? "",
    userId: record.fields["User ID"] ?? "",
    phone: record.fields.Phone ?? "",
    goals: record.fields.Goals ?? "",
    creditsRemaining: record.fields["Credits Remaining"] ?? 0,
    compCredits: [],
  }
}

async function getClientsByUserIds(
  userIds: string[],
): Promise<Map<string, { name: string; email: string; phone: string }>> {
  const map = new Map<string, { name: string; email: string; phone: string }>()
  if (userIds.length === 0) return map

  const clauses = userIds
    .map((id) => `{User ID} = '${id.replace(/'/g, "\\'")}'`)
    .join(", ")
  const records = await list<ClientFields>(TABLES.clients, {
    filterByFormula: `OR(${clauses})`,
  })

  for (const r of records) {
    const uid = r.fields["User ID"]
    if (!uid) continue
    map.set(uid, {
      name: r.fields.Name ?? "",
      email: r.fields.Email ?? "",
      phone: r.fields.Phone ?? "",
    })
  }
  return map
}
