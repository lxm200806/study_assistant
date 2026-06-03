export type WordType = 'listening' | 'speaking' | 'reading' | 'writing'

export interface LoginDto {
  username: string
  password: string
}

export interface RegisterDto {
  username: string
  password: string
}

export interface PracticeDto {
  wordId: string
  type: WordType
  isCorrect: boolean
}

export interface ChatMessageDto {
  content: string
}

export interface VocabularyStat {
  wordId: string
  word: string
  meaning: string
  type: WordType
  practiceCount: number
  correctCount: number
  mastery: number
}

export interface TrainingStats {
  listening: { total: number; mastered: number }
  speaking: { total: number; mastered: number }
  reading: { total: number; mastered: number }
  writing: { total: number; mastered: number }
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    username: string
  }
}

export interface Vocabulary {
  id: string
  word: string
  meaning: string
  phonetic: string
  image?: string
  visual?: boolean
  example?: string
  englishMeaning?: string
}