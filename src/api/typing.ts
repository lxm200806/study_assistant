import { request } from './client'
import type {
  TypingAnswerBody,
  TypingAnswerData,
  TypingQueueData,
  TypingQueueQuery
} from '@/types/api-contract'

export const typingAPI = {
  summary: (bookCode: string, mode = 'follow') =>
    request(`/typing/summary?bookCode=${encodeURIComponent(bookCode)}&mode=${encodeURIComponent(mode)}`, 'GET'),
  queue: (options: {
    bookCode?: string
    source: TypingQueueQuery['source']
    count: number
    listId?: string
    mode?: TypingQueueQuery['mode']
    includeMastered?: boolean
    allBooks?: boolean
  }) => {
    const params = new URLSearchParams({ source: options.source, count: String(options.count) })
    if (options.bookCode) params.set('bookCode', options.bookCode)
    if (options.listId) params.set('listId', options.listId)
    if (options.mode) params.set('mode', options.mode)
    if (options.includeMastered) params.set('includeMastered', '1')
    if (options.allBooks) params.set('allBooks', '1')
    return request<TypingQueueData>(`/typing/queue?${params.toString()}`, 'GET')
  },
  answer: (wordId: string, isCorrect: boolean, mode: TypingAnswerBody['mode'] = 'follow') => {
    const body: TypingAnswerBody = { wordId, isCorrect, mode }
    return request<TypingAnswerData>('/typing/answer', 'POST', body)
  },
  mark: (wordId: string, patch: { favorite?: boolean; skipMastered?: boolean }) =>
    request('/typing/marks', 'PUT', { wordId, ...patch }),
  activity: (count: number) => request('/typing/activity', 'POST', { count }),
  lists: () => request('/typing/lists', 'GET'),
  createList: (name: string, text: string) => request('/typing/lists', 'POST', { name, text }),
  deleteList: (id: string) => request(`/typing/lists/${id}`, 'DELETE'),
  articles: () => request('/typing/articles', 'GET'),
  createArticle: (title: string, body: string, translation: string) =>
    request('/typing/articles', 'POST', { title, body, translation }),
  article: (id: string) => request(`/typing/articles/${encodeURIComponent(id)}`, 'GET'),
  updateArticle: (id: string, title: string, body: string, translation: string) =>
    request(`/typing/articles/${encodeURIComponent(id)}`, 'PUT', { title, body, translation }),
  previewArticle: (id: string, body: string, translation: string) =>
    request(`/typing/articles/${encodeURIComponent(id)}/preview`, 'POST', { body, translation }),
  deleteArticle: (id: string) => request(`/typing/articles/${encodeURIComponent(id)}`, 'DELETE'),
  articleAnswer: (articleKey: string, sentenceIndex: number, isCorrect: boolean, linear = false) =>
    request('/typing/articles/answer', 'POST', { articleKey, sentenceIndex, isCorrect, linear }),
  history: (end: string) => request(`/typing/history?end=${encodeURIComponent(end)}&days=112`, 'GET'),
  session: (body: {
    date: string
    durationMs: number
    typedChars: number
    correctChars: number
    itemCount: number
    correctCount: number
    kind: 'words' | 'article'
  }) => request('/typing/sessions', 'POST', body)
}
