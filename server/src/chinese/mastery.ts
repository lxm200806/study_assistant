import {
  MASTERY_DECAY_HALF_LIFE_DAYS,
  MASTERY_HIGH,
  MASTERY_KNOWN,
  type PointLike
} from './constants'
import * as sm2 from './sm2'

export const CORRECT_GAIN = 0.22
export const WEAK_CORRECT_GAIN = 0.12
export const PLACEMENT_GAIN = 0.82
export const FAIL_KEEP = 0.62
export const FAIL_DROP = 8

export type MasteryEvent = {
  correct?: boolean
  quality?: number
  isNew?: boolean
  placement?: boolean
  day?: string
}

export function clampMastery(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function applyAttempt(score: number, event: MasteryEvent): number {
  let next = Number(score) || 0
  const quality = Number(event.quality)
  const placement = Boolean(event.placement) || (event.isNew && quality >= 5)
  if (event.correct || quality >= 3) {
    const gain = placement ? PLACEMENT_GAIN : quality >= 4 || quality >= 5 ? CORRECT_GAIN : WEAK_CORRECT_GAIN
    next += (100 - next) * gain
  } else {
    next = next * FAIL_KEEP - FAIL_DROP
  }
  return Math.max(0, Math.min(100, next))
}

export function decayMastery(score: number, daysSince: number): number {
  const safe = Math.max(0, Number(score) || 0)
  const days = Math.max(0, Number(daysSince) || 0)
  if (days <= 1 || safe <= 0) return safe
  return safe * Math.pow(0.5, days / MASTERY_DECAY_HALF_LIFE_DAYS)
}

export function daysBetween(from: string | Date | null | undefined, to: string | Date | null | undefined): number {
  const start = sm2.formatDay(from || '')
  const end = sm2.formatDay(to || '')
  if (!start || !end) return 0
  const a = sm2.parseDay(start)
  const b = sm2.parseDay(end)
  if (!a || !b) return 0
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

export function reviewIntervalDays(score: number): number {
  const value = Number(score) || 0
  if (value < 30) return 1
  if (value < 50) return 2
  if (value < 65) return 4
  if (value < MASTERY_KNOWN) return 7
  return retestIntervalDays(value)
}

export function retestIntervalDays(score: number): number {
  const extra = Math.max(0, Math.floor(((Number(score) || 0) - MASTERY_KNOWN) / 2))
  return 21 + extra
}

export function masteryLabel(score: number, practiced = true): string {
  if (!practiced || score <= 0) return '未学'
  if (score < MASTERY_KNOWN) return '学习中'
  if (score < 95) return '已掌握'
  return '很熟'
}

export function isMasteredScore(score: number): boolean {
  return Number(score) >= MASTERY_KNOWN
}

export function computeMastery(events: MasteryEvent[], lastDay: string | Date | null | undefined, today: string): number {
  let score = 0
  const ordered = [...events].sort((a, b) => String(a.day || '').localeCompare(String(b.day || '')))
  for (const event of ordered) score = applyAttempt(score, event)
  return clampMastery(decayMastery(score, daysBetween(lastDay, today)))
}

export function masteryFromLogs(
  logs: Array<{ correct?: boolean; quality?: number; isNew?: boolean; is_new?: boolean; createdAt?: Date | string; created_at?: Date | string; mode?: string }>,
  today: string
): { score: number; lastDay: string; attempts: number; errors: number } {
  const events: MasteryEvent[] = []
  let lastDay = ''
  let errors = 0
  for (const log of logs || []) {
    const day = sm2.formatDay(log.createdAt || log.created_at || '')
    const quality = Number(log.quality || 0)
    const correct = Boolean(log.correct)
    if (!correct) errors += 1
    events.push({
      correct,
      quality,
      isNew: Boolean(log.isNew ?? log.is_new),
      placement: String(log.mode || '') === 'filter',
      day
    })
    if (day && day > lastDay) lastDay = day
  }
  return {
    score: computeMastery(events, lastDay, today),
    lastDay,
    attempts: events.length,
    errors
  }
}

export function masteryFromCardStates(rows: PointLike[], today: string): number {
  const practiced = (rows || []).filter(row => row.last)
  if (!practiced.length) return 0
  const events: MasteryEvent[] = []
  let lastDay = ''
  for (const row of practiced) {
    const day = sm2.formatDay(row.last || '')
    if (day && day > lastDay) lastDay = day
    const n = Math.max(0, Number(row.n || 0))
    const lapses = Math.max(0, Number(row.lapses || 0))
    for (let i = 0; i < lapses; i++) events.push({ correct: false, quality: 1, day })
    for (let i = 0; i < Math.max(n, 1); i++) {
      events.push({ correct: true, quality: n >= 4 ? 5 : 4, day, placement: n >= 4 && i === 0 })
    }
  }
  return computeMastery(events, lastDay, today)
}

export function entryLastDay(rows: PointLike[]): string {
  let last = ''
  for (const row of rows || []) {
    const day = sm2.formatDay(row.last || '')
    if (day && day > last) last = day
  }
  return last
}

export function entryIsDue(rows: PointLike[], today: string, score?: number): boolean {
  const practiced = (rows || []).some(row => row.last)
  if (!practiced) return false
  const mastery = score == null ? masteryFromCardStates(rows, today) : score
  const last = entryLastDay(rows)
  const waited = daysBetween(last, today)
  if (waited >= reviewIntervalDays(mastery)) return true
  return (rows || []).some(row => {
    if (!row.last) return false
    const due = sm2.formatDay(row.due || '')
    return due && due <= today && !sm2.isMastered({ n: Number(row.n || 0), interval: Number(row.interval || 0) })
  })
}
