const MIN_EASE = 1.3
const FIRST_INTERVAL = 1
const SECOND_INTERVAL = 6

export interface Sm2State {
  n: number
  ef: number
  interval: number
  due: string
  lapses: number
  last: string
}

export function parseDay(dayText: unknown): Date | null {
  if (!dayText) return null
  const text = String(dayText).slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

export function formatDay(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayText(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(dayText: string, dayCount: number): string {
  const parsed = parseDay(dayText)
  if (!parsed) return ''
  parsed.setUTCDate(parsed.getUTCDate() + Number(dayCount))
  return formatDay(parsed)
}

export function schedule(state: Partial<Sm2State> | null | undefined, quality: number, today?: string): Sm2State {
  const safeToday = today || todayText()
  const prev = state && typeof state === 'object' ? state : {}
  let n = Number(prev.n || 0)
  let ef = Number(prev.ef || 2.5)
  let interval = Number(prev.interval || 0)
  let lapses = Number(prev.lapses || 0)
  let score = Number(quality)
  if (!Number.isFinite(score)) score = 0

  if (score < 3) {
    n = 0
    interval = FIRST_INTERVAL
    lapses += 1
  } else {
    if (n === 0) interval = FIRST_INTERVAL
    else if (n === 1) interval = SECOND_INTERVAL
    else interval = Math.max(1, Math.round(interval * ef))
    n += 1
    const gap = 5 - score
    ef = ef + (0.1 - gap * (0.08 + gap * 0.02))
    if (ef < MIN_EASE) ef = MIN_EASE
  }

  return {
    n,
    ef: Math.round(ef * 100) / 100,
    interval,
    due: addDays(safeToday, interval),
    lapses,
    last: safeToday
  }
}

export function isMastered(state: Partial<Sm2State> | null | undefined): boolean {
  if (!state) return false
  return Number(state.interval || 0) >= 21 || Number(state.n || 0) >= 5
}
