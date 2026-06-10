// Map type definitions for Study Assistant Mobile
export type SessionMode = 'coverage' | 'smart' | 'weak' | 'review'

export interface BookProgress {
  bookCode: string
  wordCount: number
  practicedCount: number
  coverageRate: number
  cycleRemaining: number
}

export interface VocabularyMapData {
  book?: { code: string; name: string; wordCount: number }
  summary: {
    mastered: number
    learning: number
    unfamiliar: number
    unpracticed: number
    practiced?: number
    coverageRate: number
    totalUniqueWords?: number
    masteredWords?: number
  }
  byContentType: Array<{
    type: string
    label: string
    mastered: number
    learning: number
    weak: number
    unpracticed: number
    avgMastery: number
    wordCount: number
  }>
  byTopic: Array<{
    topic: string
    label: string
    avgMastery: number
    weakCount: number
    wordCount: number
    mastered: number
  }>
  words: Array<{
    wordId: string
    word: string
    meaning: string
    contentType: string | null
    topic: string | null
    tags: string[]
    mastery: number
    status: MasteryStatus
    lastPractice: string | null
    byType: Record<string, number>
  }>
  weakestTopics: string[]
}

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  coverage: '全书覆盖',
  smart: '智能推荐',
  weak: '强化弱点',
  review: '周期复习'
}

export const STATUS_LABELS: Record<MasteryStatus, string> = {
  mastered: '已掌握',
  learning: '学习中',
  unfamiliar: '不熟悉',
  unpracticed: '未练习'
}

