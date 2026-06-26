export type AdminMember = {
  id: string
  name: string
  email: string
  userId: string
  phone: string
  goals: string
  creditsRemaining: number
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
  sessionType: string | null
}

export type AdminDashboard = {
  members: AdminMember[]
  workers: AdminWorker[]
  bookings: AdminBooking[]
}
