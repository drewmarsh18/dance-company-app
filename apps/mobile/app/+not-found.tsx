import { useEffect } from "react"
import { router } from "expo-router"
import * as WebBrowser from "expo-web-browser"

// In development the Expo dev client re-delivers exp://host:port/--/ when the
// app resumes from background (e.g. after the OAuth browser closes). Expo
// Router can't match that URL so it lands here. We call maybeCompleteAuthSession
// so the WebBrowser session resolves, then send the user back to the root.
export default function NotFoundPage() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession()
    router.replace("/")
  }, [])

  return null
}
