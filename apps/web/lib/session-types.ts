export type SessionType = "pack-hour" | "private-30" | "private-45" | "private-60" | "private-90"

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  "pack-hour": "Pack (1 hr)",
  "private-30": "Per-private (30 min)",
  "private-45": "Per-private (45 min)",
  "private-60": "Per-private (1 hr)",
  "private-90": "Per-private (90 min)",
}

export const SESSION_TYPE_CREDITS: Record<SessionType, number> = {
  "pack-hour": 1,
  "private-30": 0.5,
  "private-45": 0.75,
  "private-60": 1,
  "private-90": 1.5,
}
