import prisma from '../prisma/client'
import { getRandomWordsFromBook } from './book.service'
import { getReviewWords } from './training.service'
import { type ChatMode } from './chat.service'
import { buildSystemPrompt, getLearnerChatContext } from './chat-learner-context.service'
import { sanitizeFreeChatReply } from './chat-reply-sanitize.service'

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

export async function loadRecentChatHistory(
  userId: string,
  mode?: ChatMode
): Promise<Array<{ role: string; content: string }>> {
  const records = await prisma.chatRecord.findMany({
    where: {
      userId,
      ...(mode
        ? { OR: mode === 'free' ? [{ mode: 'free' }, { mode: null }] : [{ mode }] }
        : {})
    },
    orderBy: { createdAt: 'desc' },
    take: mode === 'free' ? 8 : HISTORY_LIMIT
  })
  return records.reverse()
    .map(r => ({ role: r.role === 'ai' ? 'assistant' : 'user', content: r.content }))
    .filter(msg => {
      if (mode !== 'free' || msg.role !== 'assistant') return true
      // Drop old drill-style AI messages so they don't "poison" the context window.
      const cleaned = sanitizeFreeChatReply(msg.content)
      return cleaned === msg.content
    })
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
  const history = await loadRecentChatHistory(userId, mode)
  const learnerContext = await getLearnerChatContext(userId, bookCode)
  const system = buildSystemPrompt(mode, learnerContext, scenario)

  return [
    { role: 'system', content: system },
    ...history.slice(0, -1),
    { role: 'user', content: userMessage }
  ]
}

export function buildFallbackResponse(
  userMessage: string,
  targetWords: string[],
  mode: ChatMode = 'free'
): string {
  const lower = userMessage.toLowerCase().trim()
  const practiceHint = targetWords.length > 0 ? ` Try using: ${targetWords.slice(0, 3).join(', ')}.` : ''

  if (/what('s| is) your name/i.test(lower)) {
    return mode === 'free'
      ? `I'm Alex! Nice to meet you. What's your name?`
      : `I'm Alex, your English practice buddy! Nice to meet you.${practiceHint}`
  }
  if (/^(hello|hi|hey|你好)/i.test(lower)) {
    return mode === 'free'
      ? `Hello! How are you today?`
      : `Hello! I'm Alex. How are you today?${practiceHint}`
  }
  if (/how are you/i.test(lower)) {
    return mode === 'free'
      ? `I'm doing well, thanks! How about you?`
      : `I'm doing well, thank you! How about you?${practiceHint}`
  }

  if (mode === 'challenge') {
    return `Good try! You said: "${userMessage}". Can you use one vocabulary word from your book in a sentence?${practiceHint}`
  }

  if (mode === 'roleplay') {
    return `You said: "${userMessage}". That's interesting! What happens next in our scene?`
  }

  return `You said: "${userMessage}". That's interesting! Tell me more.`
}
