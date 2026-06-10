// Vocabulary API
import { request } from './client'

export interface WordEntry {
  word: string
  meaning?: string
  phonetic?: string
  wordId?: string
  code?: string
}

export async function listVocabulary(page = 1, limit = 40) {
  return request(/vocabulary/list?page=&limit=, 'GET')
}
