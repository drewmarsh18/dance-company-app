import { StatusBar } from "expo-status-bar"
import { StyleSheet, View, Text, ActivityIndicator } from "react-native"
import type { UserRole } from "@cdp/core"

// Placeholder auth state — will be replaced with real Better Auth session
type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; role: UserRole; name: string }

// Temporary stub — swap for real session hook when auth is wired
const useAuth = (): AuthState => ({ status: "unauthenticated" })

export default function App() {
  const auth = useAuth()

  if (auth.status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e91e8c" />
        <StatusBar style="auto" />
      </View>
    )
  }

  if (auth.status === "unauthenticated") {
    return (
      <View style={styles.center}>
        <Text style={styles.logo}>CDP</Text>
        <Text style={styles.subtitle}>College Dance Prep</Text>
        <Text style={styles.hint}>Sign-in coming soon</Text>
        <StatusBar style="auto" />
      </View>
    )
  }

  return (
    <View style={styles.center}>
      <Text style={styles.logo}>CDP</Text>
      <Text style={styles.subtitle}>Welcome, {auth.name}</Text>
      <Text style={styles.hint}>Role: {auth.role}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logo: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#e91e8c",
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: "#444",
    fontWeight: "600",
  },
  hint: {
    fontSize: 13,
    color: "#999",
  },
})
