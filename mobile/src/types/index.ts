// Type definitions for Study Assistant Mobile
export interface Vocabulary {
  id: string
  word: string
  meaning: string
  phonetic?: string
  image?: string
  example?: string
  englishMeaning?: string
  contentType?: string
  topic?: string
  tags?: string[]
}

export interface Book {
  id: string
  code: string
  name: string
  description: string
  level: string
  wordCount: number
  isFree?: boolean
}

export type TrainingType = 'listening' | 'speaking' | 'reading' | 'writing'
export type MasteryStatus = 'mastered' | 'learning' | 'unfamiliar' | 'unpracticed'

export interface WordStats {
  count: number
  correctCount: number
  lastPractice: number
  mastery: number
}

export interface TrainingRecord {
  id: string
  type: TrainingType
  word: string
  correct: boolean
  timestamp: number
}

export interface VocabularyStats {
  listening: Record<string, WordStats>
  speaking: Record<string, WordStats>
  reading: Record<string, WordStats>
  writing: Record<string, WordStats>
}

export type MeaningType = 'chinese' | 'english'

