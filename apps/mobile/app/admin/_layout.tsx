import { Tabs } from "expo-router"
import { LayoutDashboard, Users, Star } from "lucide-react-native"
import { COLORS } from "@/constants/theme"
import { AdminProvider } from "@/lib/admin-context"

export default function AdminLayout() {
  return (
    <AdminProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarStyle: {
            borderTopColor: COLORS.border,
            backgroundColor: COLORS.background,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Overview",
            tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="members"
          options={{
            title: "Members",
            tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="prep-masters"
          options={{
            title: "Prep Masters",
            tabBarIcon: ({ color, size }) => <Star color={color} size={size} />,
          }}
        />
      </Tabs>
    </AdminProvider>
  )
}
