import React, { useCallback, useEffect, useState } from "react"
import { Tabs, useFocusEffect, usePathname } from "expo-router"
import { Home, Clock, User, Inbox } from "lucide-react-native"
import { View, Text, StyleSheet } from "react-native"
import { useColors } from "@/lib/theme-context"
import { authClient } from "@/lib/auth-client"

const API_BASE = "https://app.collegedanceprep.com"

function InboxIcon({ color, size, unread, badgeColor }: { color: string; size: number; unread: number; badgeColor: string }) {
  return (
    <View>
      <Inbox color={color} size={size} />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  badgeText: { fontSize: 8, fontWeight: "700", color: "#fff" },
})

export default function PortalLayout() {
  const COLORS = useColors()
  const [unread, setUnread] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    authClient.$fetch(`${API_BASE}/api/notifications`).then(({ data }: any) => {
      if (data?.notifications) {
        setUnread(data.notifications.filter((n: any) => !n.read).length)
      }
    }).catch(() => {})
  }, [pathname])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: { borderTopColor: COLORS.border, backgroundColor: COLORS.background },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="schedule" options={{ title: "Availability", tabBarIcon: ({ color, size }) => <Clock color={color} size={size} /> }} />
      <Tabs.Screen name="inbox" options={{
        title: "Inbox",
        tabBarIcon: ({ color, size }) => <InboxIcon color={color} size={size} unread={unread} badgeColor={COLORS.primary} />,
      }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  )
}
