import prisma from '../prisma/client'
import { getRandomWordsFromBook } from './book.service'
import { getReviewWords } from './training.service'
import { buildSystemPrompt, type ChatMode } from './chat.service'

const HISTORY_LIMIT = 20
export const FREE_DAILY_CHAT = 5

export async function assertChatQuota(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  const isPremium = user?.plan === 'premium' && (!user.planExpiresAt || user.planExpiresAt > new Date())
  if (isPremium) return

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCount = await prisma.chatRecord.count({
    where: { userId, role: 'user', createdAt: { gte: todayStart } }
  })
  if (todayCount >= FREE_DAILY_CHAT) {
    throw new Error('CHAT_LIMIT')
  }
}

export async function saveUserChatMessage(userId: string, content: string, mode?: ChatMode): Promise<void> {
  await prisma.chatRecord.create({
    data: { userId, role: 'user', content, mode }
  })
}

export async function saveAiChatMessage(userId: string, content: string, mode?: ChatMode): Promise<void> {
  await prisma.chatRecord.create({
    data: { userId, role: 'ai', content, mode }
  })
}

export async function loadRecentChatHistory(userId: string): Promise<Array<{ role: string; content: string }>> {
  const records = await prisma.chatRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT
  })
  return records.reverse().map(r => ({ role: r.role === 'ai' ? 'assistant' : 'user', content: r.content }))
}

export async function resolveTargetWords(userId: string, bookCode?: string): Promise<string[]> {
  if (!bookCode) return []

  const dueWords = await getReviewWords(userId, { bookCode, limit: 8 })
  if (dueWords.length >= 5) {
    return dueWords.map(w => w.word?.word).filter((w): w is string => !!w).slice(0, 8)
  }

  const random = await getRandomWordsFromBook(bookCode, 8)
  return random.map(w => w.word)
}

export async function buildLlmMessages(
  userId: string,
  userMessage: string,
  bookCode: string | undefined,
  mode: ChatMode,
  scenario?: string
): Promise<Array<{ role: string; content: string }>> {
  const history = await loadRecentChatHistory(userId)
  const targetWords = await resolveTargetWords(userId, bookCode)
  const system = buildSystemPrompt(bookCode, targetWords, mode, scenario)

  return [
    { role: 'system', content: system },
    ...history.slice(0, -1),
    { role: 'user', content: userMessage }
  ]
}

export function buildFallbackResponse(userMessage: string, targetWords: string[]): string {
  const greetings = ['hello', 'hi', 'hey', '你好']
  const lower = userMessage.toLowerCase()
  const hint = targetWords.length > 0 ? ` Try using: ${targetWords.slice(0, 3).join(', ')}.` : ''
  if (greetings.some(g => lower.includes(g))) {
    return `Hello! Which word would you like to practice today?${hint}`
  }
  return `Good try! You said: "${userMessage}". Can you use one vocabulary word from your book in a sentence?${hint}`
}
