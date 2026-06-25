export type SessionType = "pack-hour" | "private-30" | "private-45" | "private-60"

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  "pack-hour": "Pack (1 hr)",
  "private-30": "Per-private (30 min)",
  "private-45": "Per-private (45 min)",
  "private-60": "Per-private (1 hr)",
}
