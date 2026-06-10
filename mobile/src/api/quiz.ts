// Quiz API
import { request } from './client'

export interface QuizWord {
  id: string
  word: string
  phonetic?: string
  meaning?: string
}

export async function getQuizWords(bookCode: string, count = 30) {
  return request(/training/quiz/words?bookCode=&count=, 'GET')
}

export async function submitQuizAnswers(bookCode: string, items: Array<{ wordId: string; isCorrect: boolean }>) {
  return request('/training/quiz/submit', 'POST', { bookCode, items })
}
