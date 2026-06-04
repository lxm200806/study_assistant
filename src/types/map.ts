export type SessionMode = 'coverage' | 'random' | 'weak' | 'review'

export type MasteryStatus = 'mastered' | 'learning' | 'unfamiliar' | 'unpracticed'
export type WeakReason = 'overdue' | 'low_retention' | 'recent_lapse'

export interface BookProgress {
  bookCode: string
  wordCount: number
  practicedCount: number
  coverageRate: number
  cycleRemaining: number
  cyclePracticedCount: number
}

export interface SessionResponse {
  words: import('@/types').Vocabulary[]
  progress: BookProgress
  mode: SessionMode
}

export interface CategoryStats {
  type: string
  label: string
  mastered: number
  learning: number
  weak: number
  unpracticed: number
  avgMastery: number
  wordCount: number
}

export interface TopicStats {
  topic: string
  label: string
  avgMastery: number
  weakCount: number
  wordCount: number
  mastered: number
}

export interface WordTypeStats {
  practiceCount: number
  correctCount: number
  mastery: number
  accuracy: number
  due?: string | null
  retrievability?: number
  reps?: number
  lapses?: number
  fsrsState?: string
  weakReason?: WeakReason
}

export interface MapWordEntry {
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
  typeStats?: WordTypeStats
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
  byContentType: CategoryStats[]
  byTopic: TopicStats[]
  words: MapWordEntry[]
  weakestTopics: string[]
}

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  coverage: '全书覆盖',
  random: '随机练习',
  weak: '薄弱强化',
  review: '到期复习'
}

export const STATUS_LABELS: Record<MasteryStatus, string> = {
  mastered: '已掌握',
  learning: '熟悉',
  unfamiliar: '陌生',
  unpracticed: '未练习'
}

export const STATUS_COLORS: Record<MasteryStatus, string> = {
  mastered: '#4caf50',
  learning: '#2196f3',
  unfamiliar: '#ff9800',
  unpracticed: '#e0e0e0'
}

export const CONTENT_TYPE_COLORS: Record<string, string> = {
  fiction: '#9c27b0',
  'non-fiction': '#2196f3',
  function: '#607d8b'
}

export const TOPIC_LABELS: Record<string, string> = {
  'daily-life': '日常生活',
  school: '学校学习',
  nature: '自然动物',
  science: '科学技术',
  travel: '旅行交通',
  health: '健康医疗',
  entertainment: '娱乐文艺',
  abstract: '抽象概念',
  society: '社会政治',
  business: '商业经济'
}
