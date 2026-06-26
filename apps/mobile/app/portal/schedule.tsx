import { View, Text, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { COLORS, SPACING } from "@/constants/theme"

export default function PortalScheduleScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <Text style={styles.heading}>Schedule</Text>
        <Text style={styles.sub}>Your upcoming sessions will appear here.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, padding: SPACING.lg, justifyContent: "center", alignItems: "center", gap: SPACING.md },
  heading: { fontSize: 24, fontWeight: "700", color: COLORS.text },
  sub: { fontSize: 14, color: COLORS.textMuted },
})
