import { useEffect, useState } from "react"
import { Tabs, usePathname } from "expo-router"
import { LayoutDashboard, Users, Star, CircleUserRound, ClipboardCheck } from "lucide-react-native"
import { useColors } from "@/lib/theme-context"
import { AdminProvider } from "@/lib/admin-context"
import { authClient } from "@/lib/auth-client"

const API_BASE = "https://dance-company-app.vercel.app"

export default function AdminLayout() {
  const COLORS = useColors()
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    authClient.$fetch(`${API_BASE}/api/admin/pending-users`).then(({ data }: any) => {
      if (Array.isArray(data)) {
        const active = data.filter((u: any) => u.status === "pending").length
        setPendingCount(active)
      }
    }).catch(() => {})
  }, [pathname])

  return (
    <AdminProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarStyle: { borderTopColor: COLORS.border, backgroundColor: COLORS.background },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Overview", tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
        <Tabs.Screen name="members" options={{ title: "Members", tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
        <Tabs.Screen name="prep-masters" options={{ title: "PrepMasters", tabBarIcon: ({ color, size }) => <Star color={color} size={size} /> }} />
        <Tabs.Screen
          name="approvals"
          options={{
            title: "Approvals",
            tabBarIcon: ({ color, size }) => <ClipboardCheck color={color} size={size} />,
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          }}
        />
        <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <CircleUserRound color={color} size={size} /> }} />
      </Tabs>
    </AdminProvider>
  )
}
