import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { authClient } from "@/lib/auth-client"
import type { AdminDashboard } from "@/lib/admin-types"

const API_BASE = "https://dance-company-app.vercel.app"

type AdminContextValue = {
  data: AdminDashboard | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const AdminContext = createContext<AdminContextValue>({
  data: null,
  loading: true,
  error: null,
  refresh: async () => {},
})

export function AdminProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const { data: result, error: err } = await authClient.$fetch(
        `${API_BASE}/api/admin/dashboard`,
      )
      if (err || !result) throw new Error((err as any)?.statusText ?? "Failed to load")
      setData(result as AdminDashboard)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  return (
    <AdminContext.Provider value={{ data, loading, error, refresh }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  return useContext(AdminContext)
}
