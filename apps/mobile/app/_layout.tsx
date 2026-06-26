import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as WebBrowser from "expo-web-browser"

// Must be called at the root level so OAuth deep-link callbacks are
// intercepted here before Expo Router tries to match them as routes.
WebBrowser.maybeCompleteAuthSession()

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="member" />
        <Stack.Screen name="portal" />
      </Stack>
    </>
  )
}
