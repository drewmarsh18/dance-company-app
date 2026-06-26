import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { LayoutDashboard, Users, LogOut } from "lucide-react-native"
import { COLORS, SPACING, RADIUS, initials } from "@/constants/theme"
import { signOut, useSession } from "@/lib/auth-client"

export default function AdminProfileScreen() {
  const { data: session } = useSession()
  const router = useRouter()

  const name = session?.user?.name ?? ""
  const email = session?.user?.email ?? ""

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out", style: "destructive",
        onPress: async () => {
          await signOut()
          router.replace("/(auth)/sign-in")
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(name || email || "?")}</Text>
          </View>
          <Text style={styles.name}>{name || "(no name)"}</Text>
          <Text style={styles.email}>{email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Admin</Text>
          </View>
        </View>

        {/* Switch interface */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SWITCH VIEW</Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.replace("/member")}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Users size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Member view</Text>
              <Text style={styles.rowSub}>See the app as a member</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.replace("/portal")}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <LayoutDashboard size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Prep Master portal</Text>
              <Text style={styles.rowSub}>See the app as a Prep Master</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <LogOut size={16} color={COLORS.red} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, padding: SPACING.md, gap: SPACING.lg },
  avatarWrap: { alignItems: "center", gap: SPACING.sm, paddingTop: SPACING.lg },
  avatar: {
    width: 80, height: 80, borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 28, fontWeight: "700", color: COLORS.primary },
  name: { fontSize: 20, fontWeight: "700", color: COLORS.text },
  email: { fontSize: 14, color: COLORS.textMuted },
  roleBadge: {
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  roleText: { fontSize: 12, fontWeight: "600", color: COLORS.primary },
  section: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.8,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md },
  rowIcon: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },
  signOutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  signOutText: { fontSize: 15, fontWeight: "600", color: COLORS.red },
})
