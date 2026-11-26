import prisma from '../prisma/client'
import { getBookByCode } from './book.service'
import { recordChatVocabulary, type MatchedWord } from './vocab-match.service'
import { getLlmApiKey } from './llm-config.service'
import { completeChat } from './llm-chat.service'
import { buildFallbackResponse, loadRecentChatHistory, reserveUserChatMessage } from './chat-context.service'
import { buildSystemPrompt, getLearnerChatContext } from './chat-learner-context.service'
import { sanitizeFreeChatReply } from './chat-reply-sanitize.service'
import { getBillingUser } from './billing-user'
import { getEntitlements } from '../entitlements/entitlement.service'
import { PERMISSIONS } from '../entitlements/permissions'

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
  const quota = await reserveUserChatMessage(userId, content, mode)

  const history = await loadRecentChatHistory(userId, mode)
  const learnerContext = await getLearnerChatContext(userId, bookCode)
  const aiResponse = await generateAIResponse(content, history, learnerContext, mode, scenario)

  await prisma.chatRecord.create({
    data: { learnerId: userId, role: 'ai', content: aiResponse, mode }
  })

  const matchedWords = mode === 'challenge'
    ? await recordChatVocabulary(userId, bookCode, content, aiResponse)
    : []

  return {
    userMessage: content,
    aiResponse,
    matchedWords,
    remainingFree: quota.remaining ?? undefined
  }
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

export async function getChatRemaining(userId: string): Promise<{
  remaining: number
  isPremium: boolean
  limitValue: number | null
  period: string | null
}> {
  const account = await getBillingUser(userId)
  if (!account) return { remaining: 0, isPremium: false, limitValue: null, period: null }

  const snapshot = await getEntitlements(account.id)
  const permission = snapshot.permissions[PERMISSIONS.AI_CHAT_TEXT]
  if (!permission?.active) {
    return { remaining: 0, isPremium: false, limitValue: null, period: null }
  }
  return {
    remaining: permission.remaining ?? -1,
    isPremium: permission.limitValue == null,
    limitValue: permission.limitValue,
    period: permission.period
  }
}

export async function getChatHistory(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit
  const records = await prisma.chatRecord.findMany({
    where: { learnerId: userId },
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
