import { Redirect } from "expo-router"

// Temporary: go straight to admin until auth is wired
export default function Index() {
  return <Redirect href="/admin" />
}
