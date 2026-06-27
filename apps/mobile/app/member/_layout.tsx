import { Tabs, usePathname, useRouter } from "expo-router"
import { Home, Calendar, Package, User } from "lucide-react-native"
import { useTheme } from "@/lib/theme-context"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { BlurView } from "expo-blur"

const TABS = [
  { name: "index",    href: "/member",          label: "Home",     Icon: Home },
  { name: "bookings", href: "/member/bookings",  label: "Bookings", Icon: Calendar },
  { name: "plans",    href: "/member/plans",     label: "Plans",    Icon: Package },
  { name: "profile",  href: "/member/profile",   label: "Profile",  Icon: User },
] as const

function GlassTabBar() {
  const { colors: COLORS, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const pathname = usePathname()

  return (
    <BlurView
      intensity={isDark ? 100 : 70}
      tint={isDark ? "systemThickMaterialDark" : "systemUltraThinMaterialLight"}
      style={[styles.bar, {
        borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.1)",
        paddingBottom: insets.bottom ? insets.bottom - 4 : 8,
      }]}
    >
      {TABS.map(({ href, label, Icon }) => {
        const isActive = pathname === href || (href === "/member" && pathname === "/member/")
        return (
          <TouchableOpacity
            key={href}
            style={styles.tab}
            onPress={() => router.push(href as any)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.pill,
              isActive && {
                backgroundColor: isDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.08)",
                borderColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.14)",
              },
            ]}>
              <Icon
                size={22}
                color={isActive ? COLORS.primary : COLORS.textMuted}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
            </View>
            <Text style={[styles.label, { color: isActive ? COLORS.primary : COLORS.textMuted, fontWeight: isActive ? "700" : "500" }]}>
              {label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </BlurView>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  pill: {
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
})

export default function MemberLayout() {
  return (
    <Tabs
      tabBar={() => <GlassTabBar />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="bookings" />
      <Tabs.Screen name="plans" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="book" options={{ href: null }} />
    </Tabs>
  )
}
