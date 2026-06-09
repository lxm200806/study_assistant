import { request } from './client'

export interface Book {
  code: string
  name: string
  description?: string
  wordCount?: number
  isAvailable?: boolean
}

export async function listBooks() {
  return request<Book[]>('/books', 'GET')
}

export async function getBookProgress(code: string) {
  return request<{
    bookCode: string
    totalWords: number
    masteredWords: number
    practicedWords: number
    dueWords: number
  }>(`/books/${code}/progress`, 'GET')
}
