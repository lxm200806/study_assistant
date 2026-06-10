// Training API
import { request } from './client'

export interface TrainingRecord {
  id: string
  type: 'listening' | 'speaking' | 'reading' | 'writing'
  wordId?: string
  word?: string
  correct?: boolean
  timestamp: number
}

export async function submitPractice(wordId: string, type: string, isCorrect: boolean) {
  return request(/training/practice, 'POST', { wordId, type, isCorrect })
}

export async function getSessionReview(type?: string, bookCode?: string, limit = 5) {
  const params = new URLSearchParams()
  if (type) params.set('type', type)
  if (bookCode) params.set('bookCode', bookCode)
  params.set('limit', String(limit))
  return request(/training/review?, 'GET')
}

export async function completeSession(bookCode: string, wordIds: string[]) {
  return request('/training/session/complete', 'POST', { bookCode, wordIds })
}