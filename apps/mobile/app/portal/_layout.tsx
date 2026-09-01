import React, { useCallback, useState } from "react"
import { Tabs, useFocusEffect } from "expo-router"
import { Home, Clock, User, Bell } from "lucide-react-native"
import { View, Text, StyleSheet } from "react-native"
import { useColors } from "@/lib/theme-context"
import { authClient } from "@/lib/auth-client"

const API_BASE = "https://dance-company-app.vercel.app"

function InboxIcon({ color, size, unread }: { color: string; size: number; unread: number }) {
  return (
    <View>
      <Bell color={color} size={size} />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: color }]}>
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

  useFocusEffect(useCallback(() => {
    authClient.$fetch(`${API_BASE}/api/notifications`).then(({ data }: any) => {
      if (data?.notifications) {
        setUnread(data.notifications.filter((n: any) => !n.read).length)
      }
    }).catch(() => {})
  }, []))

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
        tabBarIcon: ({ color, size }) => <InboxIcon color={color} size={size} unread={unread} />,
      }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  )
}
