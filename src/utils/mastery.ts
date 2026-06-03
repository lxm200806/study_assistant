import type { WordStats } from '@/types'

export type TrainingType = 'listening' | 'speaking' | 'reading' | 'writing'

export interface SessionWordResult {
  word: string
  meaning?: string
  correct: boolean
  mastery: number
  practiceCount: number
  correctCount: number
}

export interface MasteryBreakdown {
  mastered: SessionWordResult[]
  learning: SessionWordResult[]
  weak: SessionWordResult[]
}

export interface SessionAnalysis {
  total: number
  correct: number
  accuracy: number
  breakdown: MasteryBreakdown
  sessionWrong: SessionWordResult[]
  newlyMastered: SessionWordResult[]
}

export const MASTERY_LABELS: Record<number, string> = {
  0: '未掌握',
  1: '生疏',
  2: '初识',
  3: '熟悉',
  4: '掌握',
  5: '精通'
}

export function getMasteryLabel(mastery: number): string {
  const level = Math.min(5, Math.max(0, Math.round(mastery)))
  return MASTERY_LABELS[level] || '未掌握'
}

export function getMasteryLevel(mastery: number): 'mastered' | 'learning' | 'weak' {
  if (mastery >= 4) return 'mastered'
  if (mastery >= 2) return 'learning'
  return 'weak'
}

export function buildSessionAnalysis(
  results: SessionWordResult[],
  previousMastery: Record<string, number> = {}
): SessionAnalysis {
  const total = results.length
  const correct = results.filter(r => r.correct).length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  const breakdown: MasteryBreakdown = {
    mastered: [],
    learning: [],
    weak: []
  }

  results.forEach(item => {
    const level = getMasteryLevel(item.mastery)
    breakdown[level].push(item)
  })

  const sessionWrong = results.filter(r => !r.correct)
  const newlyMastered = results.filter(
    r => r.mastery >= 4 && (previousMastery[r.word] || 0) < 4
  )

  return { total, correct, accuracy, breakdown, sessionWrong, newlyMastered }
}

export function wordStatsToSessionResult(
  word: string,
  meaning: string | undefined,
  correct: boolean,
  stats: WordStats | undefined
): SessionWordResult {
  return {
    word,
    meaning,
    correct,
    mastery: stats?.mastery || 0,
    practiceCount: stats?.count || 0,
    correctCount: stats?.correctCount || 0
  }
}

export function getTypeStatsFromWords(words: Record<string, WordStats>) {
  const list = Object.values(words)
  const total = list.length
  const mastered = list.filter(w => w.mastery >= 4).length
  const learning = list.filter(w => w.mastery >= 2 && w.mastery < 4).length
  const weak = list.filter(w => w.mastery < 2).length
  const avgMastery = total > 0
    ? Math.round(list.reduce((sum, w) => sum + w.mastery, 0) / total)
    : 0

  return { total, mastered, learning, weak, avgMastery }
}
