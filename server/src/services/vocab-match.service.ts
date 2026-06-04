import prisma from '../prisma/client'
import { WordType } from '../types'
import { getBookByCode } from './book.service'
import { practice } from './training.service'

export interface MatchedWord {
  wordId: string
  word: string
  type: WordType
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function getBookWordMap(bookCode: string): Promise<Map<string, { wordId: string; word: string }>> {
  const book = await getBookByCode(bookCode)
  if (!book) return new Map()

  const map = new Map<string, { wordId: string; word: string }>()
  for (const entry of book.vocabulary) {
    const key = entry.word.word.toLowerCase()
    if (!map.has(key)) {
      map.set(key, { wordId: entry.wordId, word: entry.word.word })
    }
  }
  return map
}

export function matchBookWords(
  text: string,
  wordMap: Map<string, { wordId: string; word: string }>
): { wordId: string; word: string }[] {
  if (!text.trim() || wordMap.size === 0) return []

  const lower = text.toLowerCase()
  const matched: { wordId: string; word: string }[] = []
  const seen = new Set<string>()

  const words = [...wordMap.entries()].sort((a, b) => b[0].length - a[0].length)
  for (const [key, info] of words) {
    const pattern = new RegExp(`\\b${escapeRegex(key)}\\b`, 'i')
    if (pattern.test(lower) && !seen.has(info.wordId)) {
      seen.add(info.wordId)
      matched.push(info)
    }
  }

  return matched
}

export async function recordChatVocabulary(
  userId: string,
  bookCode: string | undefined,
  userText: string,
  aiText: string
): Promise<MatchedWord[]> {
  if (!bookCode) return []

  const wordMap = await getBookWordMap(bookCode)
  const userMatches = matchBookWords(userText, wordMap)
  const aiMatches = matchBookWords(aiText, wordMap)
  const results: MatchedWord[] = []

  for (const item of userMatches) {
    await practice(userId, { wordId: item.wordId, type: 'speaking', isCorrect: true })
    results.push({ ...item, type: 'speaking' })
  }

  for (const item of aiMatches) {
    if (userMatches.some(u => u.wordId === item.wordId)) continue
    await practice(userId, { wordId: item.wordId, type: 'listening', isCorrect: true })
    results.push({ ...item, type: 'listening' })
  }

  return results
}
