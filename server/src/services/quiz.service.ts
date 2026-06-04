import prisma from '../prisma/client'
import { formatWordForClient } from '../utils/wordFormat'
import { getSessionWords, type SessionMode } from './coverage.service'

export interface QuizSubmitItem {
  wordId: string
  isCorrect: boolean
}

export async function submitQuiz(
  userId: string,
  bookCode: string,
  items: QuizSubmitItem[]
) {
  const correct = items.filter(i => i.isCorrect).length
  const total = items.length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  return {
    bookCode,
    total,
    correct,
    accuracy,
    wrongCount: total - correct
  }
}

export async function getQuizWords(userId: string, bookCode: string, count = 30) {
  const result = await getSessionWords(userId, bookCode, count, 'smart' as SessionMode)
  return result.words.map(w => formatWordForClient(w as any))
}
