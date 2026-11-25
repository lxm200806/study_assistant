import { request, requestDirect } from './client'
import type {
  BookDetailData,
  BookListData,
  BookMapData,
  BookSessionData,
  CompleteSessionBody,
  CompleteSessionResponse,
  HistoryData,
  PracticeBody,
  PracticeData,
  QuizSubmitBody,
  QuizSubmitData,
  QuizWordsData,
  ReviewData,
  ReviewQuery
} from '@/types/api-contract'

export const vocabularyAPI = {
  list: async (page: number = 1, limit: number = 20) => {
    return request(`/vocab?page=${page}&limit=${limit}`, 'GET')
  },
  detail: async (id: string) => {
    return request(`/vocab/${id}`, 'GET')
  },
  random: async (count: number = 10) => {
    return request(`/vocab/random?count=${count}`, 'GET')
  },
  stats: async () => {
    return request('/vocab/stats', 'GET')
  }
}

export const trainingAPI = {
  practice: async (wordId: string, type: PracticeBody['type'], isCorrect: boolean) => {
    const body: PracticeBody = { wordId, type, isCorrect }
    return request<PracticeData>('/training/practice', 'POST', body)
  },
  recheck: async (bookCode: string, wordId: string, type: string, isCorrect: boolean) => {
    return request('/training/recheck', 'POST', { bookCode, wordId, type, isCorrect })
  },
  review: async (type?: ReviewQuery['type'], bookCode?: string, limit?: number) => {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (bookCode) params.set('bookCode', bookCode)
    if (limit) params.set('limit', String(limit))
    const query = params.toString()
    return request<ReviewData>(`/training/review${query ? `?${query}` : ''}`, 'GET')
  },
  completeSession: async (bookCode: string, wordIds: string[], sessionTokens: string[] = []) => {
    const body: CompleteSessionBody = { bookCode, wordIds, sessionTokens }
    return requestDirect<CompleteSessionResponse>('/training/session/complete', 'POST', body)
  },
  history: async (page: number = 1, limit: number = 20) => {
    return request<HistoryData>(`/training/history?page=${page}&limit=${limit}`, 'GET')
  }
}

export const bookAPI = {
  list: async () => {
    return request<BookListData>('/books', 'GET')
  },
  detail: async (code: string) => {
    return request<BookDetailData>(`/books/${code}`, 'GET')
  },
  random: async (code: string, count: number = 10) => {
    return request(`/books/${code}/random?count=${count}`, 'GET')
  },
  session: async (
    code: string,
    count: number = 10,
    mode: string = 'coverage',
    type?: string,
    topic?: string,
    opts?: { unit?: string; excludeIds?: string[] }
  ) => {
    const params = new URLSearchParams({ count: String(count), mode })
    if (type) params.set('type', type)
    if (topic) params.set('topic', topic)
    if (opts?.unit) params.set('unit', opts.unit)
    if (opts?.excludeIds?.length) params.set('exclude', opts.excludeIds.join(','))
    return request<BookSessionData>(`/books/${code}/session?${params.toString()}`, 'GET')
  },
  progress: async (code: string) => {
    return request(`/books/${code}/progress`, 'GET')
  },
  dueCount: async (code: string, type?: string) => {
    const typeQuery = type ? `?type=${type}` : ''
    return request(`/books/${code}/due-count${typeQuery}`, 'GET')
  }
}

export const statsAPI = {
  bookMap: async (code: string, type?: string) => {
    const typeQuery = type ? `?type=${type}` : ''
    // Mounted on /api/vocab (see server vocab.routes + app.ts)
    return request<BookMapData>(`/vocab/maps/book/${encodeURIComponent(code)}${typeQuery}`, 'GET')
  },
  globalMap: async () => {
    return request('/vocab/maps/global?limit=8000', 'GET')
  },
  daily: async () => {
    return request('/stats/daily', 'GET')
  },
  weeklyReport: async () => {
    return request('/stats/weekly-report', 'GET')
  }
}

export const quizAPI = {
  words: async (bookCode: string, count: number = 30) => {
    return request<QuizWordsData>(`/training/quiz/words?bookCode=${bookCode}&count=${count}`, 'GET')
  },
  submit: async (bookCode: string, items: QuizSubmitBody['items']) => {
    const body: QuizSubmitBody = { bookCode, items }
    return request<QuizSubmitData>('/training/quiz/submit', 'POST', body)
  }
}
