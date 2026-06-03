import type { WordType } from '../types'

export type MasteryStatus = 'mastered' | 'learning' | 'unfamiliar' | 'unpracticed'

const WORD_TYPES: WordType[] = ['listening', 'speaking', 'reading', 'writing']

export function getMasteryStatus(mastery: number, practiced: boolean): MasteryStatus {
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
}

export interface AggregatedWordMastery {
  wordId: string
  mastery: number
  practiced: boolean
  practiceCount: number
  byType: Partial<Record<WordType, number>>
  lastPractice: Date | null
}

export function aggregateWordMastery(stats: WordStatEntry[]): AggregatedWordMastery | null {
  if (stats.length === 0) return null

  const wordId = stats[0].wordId
  const byType: Partial<Record<WordType, number>> = {}
  let totalMastery = 0
  let typeCount = 0
  let totalPractice = 0
  let lastPractice: Date | null = null

  for (const stat of stats) {
    byType[stat.type] = stat.mastery
    totalMastery += stat.mastery
    typeCount++
    totalPractice += stat.practiceCount
    if (stat.lastPractice && (!lastPractice || stat.lastPractice > lastPractice)) {
      lastPractice = stat.lastPractice
    }
  }

  const practiced = totalPractice > 0
  const mastery = typeCount > 0 ? Math.round(totalMastery / typeCount) : 0

  return { wordId, mastery, practiced, practiceCount: totalPractice, byType, lastPractice }
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

export function getPriorityScore(mastery: AggregatedWordMastery, inCurrentCycle: boolean): number {
  if (!mastery.practiced) return 1000
  if (mastery.mastery < 2) return 800 - mastery.mastery * 50
  if (mastery.mastery < 4) return 400 - mastery.mastery * 30
  if (inCurrentCycle) return 50
  return 200 - mastery.mastery * 10
}

export { WORD_TYPES }
