import { TABLES, appBase, getPlansForUser, type ClientFields } from "@/lib/airtable"

export type ClientProfile = {
  recordId: string
  name: string
  email: string
  phone: string
  goals: string
  creditsRemaining: number
  parentEmail: string
  effectiveUserId: string
  isParentView: boolean
  isNewProfile: boolean
}

async function findClientRecord(userId: string) {
  const safeId = userId.replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `{User ID} = '${safeId}'`,
    maxRecords: 1,
    revalidate: 0,
  })
  return records[0] ?? null
}

async function findClientByEmail(email: string) {
  const safe = email.trim().toLowerCase().replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `LOWER({Email}) = '${safe}'`,
    maxRecords: 1,
    revalidate: 0,
  })
  return records[0] ?? null
}

async function findClientByParentEmail(parentEmail: string) {
  const safe = parentEmail.trim().toLowerCase().replace(/'/g, "\\'")
  const records = await appBase.list<ClientFields>(TABLES.clients, {
    filterByFormula: `LOWER({Parent Email}) = '${safe}'`,
    maxRecords: 1,
    revalidate: 0,
  })
  return records[0] ?? null
}

export async function resolveClientProfile(
  user: { id: string; email: string; name: string },
  noCreate = false,
): Promise<ClientProfile> {
  let record = await findClientRecord(user.id)

  if (!record) {
    const byEmail = await findClientByEmail(user.email ?? "")
    if (byEmail) {
      if (!byEmail.fields["User ID"]) {
        record = await appBase.update<ClientFields>(TABLES.clients, byEmail.id, {
          "User ID": user.id,
          Name: byEmail.fields.Name || user.name,
        })
      } else if (byEmail.fields["User ID"] === user.id) {
        record = byEmail
      }
    }
  }

  if (!record) {
    const byParentEmail = await findClientByParentEmail(user.email ?? "")
    if (byParentEmail) {
      return {
        recordId: byParentEmail.id,
        name: byParentEmail.fields.Name ?? "",
        email: byParentEmail.fields.Email ?? "",
        phone: byParentEmail.fields.Phone ?? "",
        goals: byParentEmail.fields.Goals ?? "",
        creditsRemaining: byParentEmail.fields["Credits Remaining"] ?? 0,
        parentEmail: byParentEmail.fields["Parent Email"] ?? user.email,
        effectiveUserId: byParentEmail.fields["User ID"] ?? "",
        isParentView: true,
        isNewProfile: false,
      }
    }
  }

  let isNewProfile = false
  if (!record && !noCreate) {
    record = await appBase.create<ClientFields>(TABLES.clients, {
      Name: user.name,
      Email: user.email,
      "User ID": user.id,
      "Credits Remaining": 0,
    })
    isNewProfile = true
  }

  return {
    recordId: record?.id ?? "",
    name: record?.fields.Name ?? user.name,
    email: record?.fields.Email ?? user.email,
    phone: record?.fields.Phone ?? "",
    goals: record?.fields.Goals ?? "",
    creditsRemaining: record?.fields["Credits Remaining"] ?? 0,
    parentEmail: record?.fields["Parent Email"] ?? "",
    effectiveUserId: record?.fields["User ID"] ?? user.id,
    isParentView: false,
    isNewProfile,
  }
}

export { getPlansForUser }
