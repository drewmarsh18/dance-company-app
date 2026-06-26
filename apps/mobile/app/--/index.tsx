import * as WebBrowser from "expo-web-browser"

// This route handles the OAuth redirect in development (exp://host:port/--/).
// Calling maybeCompleteAuthSession() here closes the in-app browser and hands
// control back to the openAuthSessionAsync caller inside expoClient.
WebBrowser.maybeCompleteAuthSession()

export default function AuthRedirectPage() {
  return null
}
