import type { WordType } from '../types'
import {
  getMasteryStatus as deriveMasteryStatus,
  getWeakReason,
  buildFsrsFieldsFromStat,
  computeWeakPriorityScore,
  type MasteryStatus,
  type WeakReason
} from './review-engine.service'

export type { MasteryStatus, WeakReason }

const WORD_TYPES: WordType[] = ['listening', 'speaking', 'reading', 'writing']

export function getMasteryStatus(
  mastery: number,
  practiced: boolean,
  stat?: {
    practiceCount?: number
    reps?: number
    retrievability?: number
    due?: Date | null
    fsrsState?: string
    recentLapse?: boolean
  }
): MasteryStatus {
  if (stat) {
    return deriveMasteryStatus(buildFsrsFieldsFromStat(stat))
  }

  if (!practiced || mastery === 0) return 'unpracticed'
  if (mastery >= 4) return 'mastered'
  if (mastery >= 2) return 'learning'
  return 'unfamiliar'
}

export interface WordStatEntry {
  wordId: string
  type: WordType
  practiceCount: number
  correctCount: number
  mastery: number
  lastPractice: Date | null
  due?: Date | null
  stability?: number
  difficulty?: number
  reps?: number
  lapses?: number
  fsrsState?: string
  lastReview?: Date | null
  retrievability?: number
  recentLapse?: boolean
  weakReason?: WeakReason
}

export interface AggregatedWordMastery {
  wordId: string
  mastery: number
  practiced: boolean
  practiceCount: number
  byType: Partial<Record<WordType, number>>
  lastPractice: Date | null
  retrievability?: number
  due?: Date | null
  fsrsState?: string
}

export function aggregateWordMastery(stats: WordStatEntry[]): AggregatedWordMastery | null {
  if (stats.length === 0) return null

  const wordId = stats[0].wordId
  const byType: Partial<Record<WordType, number>> = {}
  let totalMastery = 0
  let typeCount = 0
  let totalPractice = 0
  let lastPractice: Date | null = null
  let lowestRetrievability = 1
  let earliestDue: Date | null = null
  let primaryState = 'New'

  for (const stat of stats) {
    byType[stat.type] = stat.mastery
    totalMastery += stat.mastery
    typeCount++
    totalPractice += stat.practiceCount
    if (stat.lastPractice && (!lastPractice || stat.lastPractice > lastPractice)) {
      lastPractice = stat.lastPractice
    }
    if ((stat.retrievability ?? 1) < lowestRetrievability) {
      lowestRetrievability = stat.retrievability ?? 1
      primaryState = stat.fsrsState ?? 'New'
      earliestDue = stat.due ?? null
    }
  }

  const practiced = totalPractice > 0
  const mastery = typeCount > 0 ? Math.round(totalMastery / typeCount) : 0

  return {
    wordId,
    mastery,
    practiced,
    practiceCount: totalPractice,
    byType,
    lastPractice,
    retrievability: practiced ? lowestRetrievability : 0,
    due: earliestDue,
    fsrsState: primaryState
  }
}

export function aggregateBookWordStats(
  wordIds: string[],
  statsByWordId: Map<string, WordStatEntry[]>
): Map<string, AggregatedWordMastery> {
  const result = new Map<string, AggregatedWordMastery>()

  for (const wordId of wordIds) {
    const stats = statsByWordId.get(wordId) || []
    const aggregated = aggregateWordMastery(stats)
    result.set(wordId, aggregated || {
      wordId,
      mastery: 0,
      practiced: false,
      practiceCount: 0,
      byType: {},
      lastPractice: null
    })
  }

  return result
}

export function getPriorityScore(
  mastery: AggregatedWordMastery,
  inCurrentCycle: boolean,
  typeStat?: WordStatEntry
): number {
  if (typeStat) {
    return computeWeakPriorityScore(buildFsrsFieldsFromStat(typeStat))
  }

  if (!mastery.practiced) return 1000
  if (mastery.mastery < 2) return 800 - mastery.mastery * 50
  if (mastery.mastery < 4) return 400 - mastery.mastery * 30
  if (inCurrentCycle) return 50
  return 200 - mastery.mastery * 10
}

export function buildTypeStatsFromEntry(entry?: WordStatEntry) {
  if (!entry || entry.practiceCount <= 0) {
    return {
      practiceCount: 0,
      correctCount: 0,
      mastery: 0,
      accuracy: 0,
      due: null as Date | null,
      retrievability: 0,
      reps: 0,
      lapses: 0,
      fsrsState: 'New' as const,
      weakReason: undefined as WeakReason | undefined
    }
  }

  const fields = buildFsrsFieldsFromStat(entry)
  return {
    practiceCount: entry.practiceCount,
    correctCount: entry.correctCount,
    mastery: fields.mastery,
    accuracy: Math.round((entry.correctCount / entry.practiceCount) * 100),
    due: fields.due,
    retrievability: fields.retrievability,
    reps: fields.reps,
    lapses: fields.lapses,
    fsrsState: fields.fsrsState,
    weakReason: getWeakReason(fields)
  }
}

export { WORD_TYPES, getWeakReason }
