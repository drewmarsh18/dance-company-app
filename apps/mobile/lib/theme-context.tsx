import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useColorScheme } from "react-native"
import * as SecureStore from "expo-secure-store"
import { LIGHT_COLORS, DARK_COLORS } from "@/constants/theme"

export type ThemePreference = "light" | "dark" | "system"

const STORE_KEY = "theme-preference"

type ThemeContextValue = {
  colors: typeof LIGHT_COLORS
  isDark: boolean
  theme: ThemePreference
  setTheme: (t: ThemePreference) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LIGHT_COLORS,
  isDark: false,
  theme: "system",
  setTheme: async () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [theme, setThemeState] = useState<ThemePreference>("system")

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY).then((val) => {
      if (val === "light" || val === "dark" || val === "system") {
        setThemeState(val)
      }
    })
  }, [])

  const isDark = theme === "dark" || (theme === "system" && systemScheme === "dark")
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS

  async function setTheme(t: ThemePreference) {
    setThemeState(t)
    await SecureStore.setItemAsync(STORE_KEY, t)
  }

  return (
    <ThemeContext.Provider value={{ colors, isDark, theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export function useColors() {
  return useContext(ThemeContext).colors
}
