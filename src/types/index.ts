export interface Vocabulary {
  id: string
  word: string
  meaning: string
  phonetic: string
  /** emoji 配图，简单词使用 */
  image?: string
  /** 是否有配图（简单词 true，复杂词 false） */
  visual?: boolean
  example?: string
  englishMeaning?: string
  contentType?: string
  topic?: string
  tags?: string[]
}

export interface WordStats {
  count: number
  correctCount: number
  lastPractice: number
  mastery: number
}

export interface VocabularyStats {
  listening: Record<string, WordStats>
  speaking: Record<string, WordStats>
  reading: Record<string, WordStats>
  writing: Record<string, WordStats>
}

export interface TrainingRecord {
  id: string
  type: 'listening' | 'speaking' | 'reading' | 'writing'
  word: string
  correct: boolean
  timestamp: number
}

export interface TrainingStats {
  total: number
  mastered: number
  avgMastery: number
}

export type MeaningType = 'chinese' | 'english'
