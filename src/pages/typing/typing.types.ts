import type { PersistedWordMode } from '@/utils/typing'

export interface TypingWord {
  id: string
  word: string
  meaning: string
  phonetic: string
  englishMeaning?: string
  example?: string
  examples?: string[]
  topic?: string
  tags?: string[]
  favorite: boolean
  skipMastered: boolean
  inWrongBook: boolean
  due?: string | null
  practiced?: boolean
  recentLapse?: boolean
  phoneticUk?: string
  phoneticUs?: string
  synonyms?: string
  roots?: string
  etymology?: string
  phrases?: string
  note?: string
  wrongSource?: string
}

export interface Summary {
  due: number
  unseen: number
  skipped: number
  wrong: number
  favorite: number
}

export interface ArticleRow {
  id: string
  title: string
  sentenceCount: number
  builtin?: boolean
  source?: string
}

export interface SentenceItem {
  text: string
  translation: string
  articleKey: string
  index: number
  title?: string
}

export interface RejectedToken {
  token: string
  reason: string
}

export interface Answered {
  id: string
  label: string
  ok: boolean
}

export type WordMode = PersistedWordMode
export type ArticleMode = 'follow' | 'dictation'
export type Source = 'smart' | 'wrong' | 'favorite' | 'random'
export type Stage = 'setup' | 'practice' | 'bridge' | 'done'
export type WordPhase = 'learn' | 'exam'
export type ExamMode = 'recall' | 'dictation'
export type ExamCard = { wordIndex: number; mode: ExamMode }
