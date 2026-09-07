import type { PointLike } from './constants'

export const MODES = ['learn', 'test', 'recite'] as const
export type StudyMode = (typeof MODES)[number]
export const DEFAULT_MODE: StudyMode = 'learn'
export const LEARN_REVEAL_QUALITY = 3
export const MODE_OPTIONS = [
  { id: 'learn', label: '学习', hint: '先练会' },
  { id: 'test', label: '测试', hint: '考考你' },
  { id: 'recite', label: '背诵', hint: '读出来' }
] as const

const LINE_SPLIT = /(?<=[。！？；!?;\n])/

export interface PlannedToday {
  groups: Array<{ role?: string; energy?: number; rows?: PointLike[]; [key: string]: unknown }>
  tasks?: number
  cards?: number
  newEnergy?: number
  reviewEnergy?: number
  mode?: string
  energyCharged?: boolean
  [key: string]: unknown
}

export function normalizeMode(value: unknown, fallback: StudyMode = DEFAULT_MODE): StudyMode {
  const text = String(value || '').trim().toLowerCase()
  if ((MODES as readonly string[]).includes(text)) return text as StudyMode
  const aliases: Record<string, StudyMode> = { 学习: 'learn', 测试: 'test', 背诵: 'recite' }
  return aliases[String(value || '').trim()] || ((MODES as readonly string[]).includes(fallback) ? fallback : DEFAULT_MODE)
}

export function defaultStudyMode(planned: PlannedToday | null | undefined): StudyMode {
  const groups = [...((planned || {}).groups || [])]
  if (groups.length && groups[0].role === 'review') return 'test'
  const reviewEnergy = Number((planned || {}).reviewEnergy || 0)
  const newEnergy = Number((planned || {}).newEnergy || 0)
  if (reviewEnergy && !newEnergy) return 'test'
  return 'learn'
}

export function hasReviewWork(planned: PlannedToday | null | undefined): boolean {
  const groups = [...((planned || {}).groups || [])]
  if (groups.some(group => group.role === 'review')) return true
  return Number((planned || {}).reviewEnergy || 0) > 0
}

export function resolveDefaultMode(planned: PlannedToday | null | undefined, reviewDefaultTest = false): StudyMode {
  if (reviewDefaultTest && hasReviewWork(planned)) return 'test'
  return defaultStudyMode(planned)
}

export function groupsForMode<T extends { role?: string }>(groups: T[] | null | undefined, mode: unknown): T[] {
  const active = normalizeMode(mode)
  const rows = [...(groups || [])]
  if (active !== 'test') return rows
  const review = rows.filter(group => group.role === 'review')
  return review.length ? review : rows
}

export function applyTodayMode(planned: PlannedToday, mode: unknown): PlannedToday {
  const next = { ...planned }
  const active = normalizeMode(mode)
  const groups = groupsForMode(next.groups || [], active)
  const newEnergy = groups.filter(group => group.role !== 'review').reduce((sum, group) => sum + Number(group.energy || 0), 0)
  const reviewEnergy = groups.filter(group => group.role === 'review').reduce((sum, group) => sum + Number(group.energy || 0), 0)
  const charged = active !== 'recite'
  next.groups = groups
  next.tasks = groups.length
  next.cards = groups.reduce((sum, group) => sum + ((group.rows || []).length), 0)
  next.newEnergy = charged ? newEnergy : 0
  next.reviewEnergy = charged ? reviewEnergy : 0
  next.mode = active
  next.energyCharged = charged
  return next
}

export function answerLines(answer: unknown): string[] {
  const text = String(answer || '').trim()
  if (!text) return []
  const parts = text.split(LINE_SPLIT).map(item => item.trim()).filter(Boolean)
  return parts.length ? parts : [text]
}

export function reviewOutcome(mode: unknown, gradeResult: { quality?: number; correct?: boolean }, revealed = false) {
  const active = normalizeMode(mode)
  const quality = Number(gradeResult?.quality || 1)
  const correct = Boolean(gradeResult?.correct)
  if (active === 'test' && revealed) {
    return { ok: false, error: '测试模式不能看答案', mode: active, update_sm2: false as const }
  }
  if (active === 'recite') {
    return { ok: true, mode: active, quality, correct, update_sm2: false, revealed: Boolean(revealed) }
  }
  if (active === 'learn' && revealed) {
    return { ok: true, mode: active, quality: LEARN_REVEAL_QUALITY, correct: false, update_sm2: true, revealed: true }
  }
  return { ok: true, mode: active, quality, correct, update_sm2: true, revealed: Boolean(revealed) }
}
