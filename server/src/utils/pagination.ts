export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}
