import prisma from '../prisma/client'
import { getBookByCode } from './book.service'
import { getReviewWords } from './training.service'
import { recordChatVocabulary, type MatchedWord } from './vocab-match.service'
import { getLlmApiKey } from './llm-config.service'
import { completeChat } from './llm-chat.service'
import { buildFallbackResponse, loadRecentChatHistory } from './chat-context.service'
import { buildSystemPrompt, getLearnerChatContext } from './chat-learner-context.service'
import { sanitizeFreeChatReply } from './chat-reply-sanitize.service'

const FREE_DAILY_CHAT = 5

export type ChatMode = 'free' | 'challenge' | 'roleplay'

export interface SendChatResult {
  userMessage: string
  aiResponse: string
  matchedWords: MatchedWord[]
  remainingFree?: number
}

export async function sendChatMessage(
  userId: string,
  content: string,
  bookCode?: string,
  mode: ChatMode = 'free',
  scenario?: string
): Promise<SendChatResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  const isPremium = user?.plan === 'premium' && (!user.planExpiresAt || user.planExpiresAt > new Date())

  if (!isPremium) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayCount = await prisma.chatRecord.count({
      where: { userId, role: 'user', createdAt: { gte: todayStart } }
    })
    if (todayCount >= FREE_DAILY_CHAT) {
      throw new Error('CHAT_LIMIT')
    }
  }

  await prisma.chatRecord.create({
    data: { userId, role: 'user', content, mode }
  })

  const history = await loadRecentChatHistory(userId, mode)
  const learnerContext = await getLearnerChatContext(userId, bookCode)
  const aiResponse = await generateAIResponse(content, history, learnerContext, mode, scenario)

  await prisma.chatRecord.create({
    data: { userId, role: 'ai', content: aiResponse, mode }
  })

  const matchedWords = mode === 'challenge'
    ? await recordChatVocabulary(userId, bookCode, content, aiResponse)
    : []

  let remainingFree: number | undefined
  if (!isPremium) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayCount = await prisma.chatRecord.count({
      where: { userId, role: 'user', createdAt: { gte: todayStart } }
    })
    remainingFree = Math.max(0, FREE_DAILY_CHAT - todayCount)
  }

  return { userMessage: content, aiResponse, matchedWords, remainingFree }
}

async function generateAIResponse(
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  learnerContext: Awaited<ReturnType<typeof getLearnerChatContext>>,
  mode: ChatMode,
  scenario?: string
): Promise<string> {
  const llmOptions = mode === 'free' ? { temperature: 0.4 } : undefined

  if (getLlmApiKey()) {
    const system = buildSystemPrompt(mode, learnerContext, scenario)
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: system },
      ...history.slice(0, -1),
      { role: 'user', content: userMessage }
    ]
    const llm = await completeChat(messages, llmOptions)
    if (llm) {
      return mode === 'free' ? sanitizeFreeChatReply(llm, userMessage) : llm
    }
  }
  return buildFallbackResponse(userMessage, learnerContext.backgroundWords, mode)
}

export async function getChatRemaining(userId: string): Promise<{ remaining: number; isPremium: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  const isPremium = user?.plan === 'premium' && (!user.planExpiresAt || user.planExpiresAt > new Date())
  if (isPremium) return { remaining: -1, isPremium: true }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCount = await prisma.chatRecord.count({
    where: { userId, role: 'user', createdAt: { gte: todayStart } }
  })
  return { remaining: Math.max(0, FREE_DAILY_CHAT - todayCount), isPremium: false }
}

export async function getChatHistory(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit
  const records = await prisma.chatRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit
  })
  return records.reverse()
}

export async function getBookLevel(bookCode: string): Promise<string | undefined> {
  const book = await getBookByCode(bookCode)
  return book?.level ?? undefined
}
