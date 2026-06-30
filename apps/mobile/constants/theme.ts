export const LIGHT_COLORS = {
  primary: "#e91e8c",
  primaryLight: "#fce7f3",
  background: "#ffffff",
  surface: "#f9f9f9",
  border: "#e5e5e5",
  text: "#111111",
  textSecondary: "#666666",
  textMuted: "#999999",
  green: "#16a34a",
  greenLight: "#dcfce7",
  amber: "#d97706",
  amberLight: "#fef3c7",
  red: "#dc2626",
  redLight: "#fee2e2",
  gray: "#6b7280",
  grayLight: "#f3f4f6",
}

export const DARK_COLORS = {
  primary: "#f472b6",
  primaryLight: "#3b1a2e",
  background: "#0f0f0f",
  surface: "#1a1a1a",
  border: "#2e2e2e",
  text: "#f0f0f0",
  textSecondary: "#a0a0a0",
  textMuted: "#666666",
  green: "#4ade80",
  greenLight: "#052e16",
  amber: "#fbbf24",
  amberLight: "#1c1207",
  red: "#f87171",
  redLight: "#2d0a0a",
  gray: "#9ca3af",
  grayLight: "#1f1f1f",
}

export const COLORS = LIGHT_COLORS

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
}

export const FONTS = {
  /** Geist — body text, matches web sans-serif */
  sans: "Geist_400Regular",
  sansMedium: "Geist_500Medium",
  sansSemiBold: "Geist_600SemiBold",
  sansBold: "Geist_700Bold",
  /** Sora — headings, matches web font-heading */
  heading: "Sora_600SemiBold",
  headingBold: "Sora_700Bold",
}
