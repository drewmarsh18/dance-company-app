import React, { useCallback, useState } from "react"
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect } from "expo-router"
import { Bell, CheckCheck, Calendar, Package, ShieldCheck, Info } from "lucide-react-native"
import { authClient } from "@/lib/auth-client"
import { useTheme } from "@/lib/theme-context"
import { SPACING, RADIUS } from "@/constants/theme"

const API_BASE = "https://dance-company-app.vercel.app"

type Notif = {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  bookingId: string | null
  createdAt: string
}

function typeIcon(type: string, color: string) {
  const size = 18
  if (type.startsWith("booking")) return <Calendar size={size} color={color} />
  if (type.startsWith("account")) return <ShieldCheck size={size} color={color} />
  if (type.startsWith("plan") || type.startsWith("credit")) return <Package size={size} color={color} />
  return <Info size={size} color={color} />
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function InboxScreen() {
  const { colors: COLORS } = useTheme()
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const styles = makeStyles(COLORS)

  const load = useCallback(async () => {
    const { data, error } = await authClient.$fetch(`${API_BASE}/api/notifications`)
    if (!error && data) setNotifs((data as any).notifications ?? [])
  }, [])

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false))
  }, [load]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  async function markRead(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    await authClient.$fetch(`${API_BASE}/api/notifications`, {
      method: "PATCH",
      body: JSON.stringify({ id }),
    })
  }

  async function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
    await authClient.$fetch(`${API_BASE}/api/notifications`, {
      method: "PATCH",
      body: JSON.stringify({}),
    })
  }

  const unreadCount = notifs.filter((n) => !n.read).length

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn} activeOpacity={0.7}>
            <CheckCheck size={15} color={COLORS.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifs}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={notifs.length === 0 ? styles.emptyContainer : styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Bell size={40} color={COLORS.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySub}>You'll see booking updates and account activity here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, !item.read && styles.rowUnread]}
            activeOpacity={0.7}
            onPress={() => !item.read && markRead(item.id)}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.read ? COLORS.surface : COLORS.primaryLight ?? COLORS.surface }]}>
              {typeIcon(item.type, item.read ? COLORS.textMuted : COLORS.primary)}
            </View>
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={[styles.rowTitle, !item.read && styles.rowTitleUnread]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
              </View>
              <Text style={styles.rowBody2} numberOfLines={2}>{item.body}</Text>
            </View>
            {!item.read && <View style={styles.dot} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}

function makeStyles(COLORS: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.md,
    },
    title: { fontSize: 26, fontWeight: "700", color: COLORS.text, fontFamily: "Sora_700Bold" },
    markAllBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    markAllText: { fontSize: 13, color: COLORS.primary, fontWeight: "600" },
    list: { paddingBottom: SPACING.xl },
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyBox: { alignItems: "center", gap: SPACING.sm, paddingHorizontal: SPACING.lg },
    emptyTitle: { fontSize: 16, fontWeight: "600", color: COLORS.text, textAlign: "center" },
    emptySub: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 20 },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      gap: SPACING.sm,
      backgroundColor: COLORS.background,
    },
    rowUnread: { backgroundColor: COLORS.surface },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.sm,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    rowBody: { flex: 1, gap: 3 },
    rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    rowTitle: { fontSize: 14, fontWeight: "500", color: COLORS.textMuted, flex: 1 },
    rowTitleUnread: { fontWeight: "700", color: COLORS.text },
    rowTime: { fontSize: 11, color: COLORS.textMuted, flexShrink: 0 },
    rowBody2: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: COLORS.primary,
      marginTop: 5,
      flexShrink: 0,
    },
  })
}
