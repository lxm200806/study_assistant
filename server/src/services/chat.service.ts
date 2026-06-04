import prisma from '../prisma/client'
import { getBookByCode, getRandomWordsFromBook } from './book.service'
import { getReviewWords } from './training.service'
import { recordChatVocabulary, type MatchedWord } from './vocab-match.service'

const FREE_DAILY_CHAT = 5
const HISTORY_LIMIT = 20

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

  const history = await loadRecentHistory(userId)
  const targetWords = await resolveTargetWords(userId, bookCode)
  const aiResponse = await generateAIResponse(content, bookCode, history, targetWords, mode, scenario)

  await prisma.chatRecord.create({
    data: { userId, role: 'ai', content: aiResponse, mode }
  })

  const matchedWords = await recordChatVocabulary(userId, bookCode, content, aiResponse)

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

async function loadRecentHistory(userId: string): Promise<Array<{ role: string; content: string }>> {
  const records = await prisma.chatRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT
  })
  return records.reverse().map(r => ({ role: r.role === 'ai' ? 'assistant' : 'user', content: r.content }))
}

async function resolveTargetWords(userId: string, bookCode?: string): Promise<string[]> {
  if (!bookCode) return []

  const dueWords = await getReviewWords(userId, { bookCode, limit: 8 })
  if (dueWords.length >= 5) {
    return dueWords.map(w => w.word?.word).filter((w): w is string => !!w).slice(0, 8)
  }

  const random = await getRandomWordsFromBook(bookCode, 8)
  return random.map(w => w.word)
}

export function buildSystemPrompt(
  bookCode: string | undefined,
  targetWords: string[],
  mode: ChatMode = 'free',
  scenario?: string
): string {
  const bookLabel = bookCode ? `词书 ${bookCode.toUpperCase()}` : '通用英语'
  const wordHint = targetWords.length > 0
    ? `建议练习词汇：${targetWords.join(', ')}`
    : '鼓励用户使用最近学过的词汇'

  const base = [
    '你是英语词汇学习助手，帮助用户练习口语和听力。',
    `用户正在学习 ${bookLabel}。`,
    wordHint,
    '回复要求：以英文为主，可辅以简短中文解释；句子简短（1-3句）；纠正明显语法错误；语气友好鼓励。'
  ]

  if (mode === 'challenge') {
    base.push('当前模式：用词挑战。引导用户用目标词汇造句，并在用户用到目标词时给予肯定。')
  } else if (mode === 'roleplay') {
    const scene = scenario || '日常对话'
    base.push(`当前模式：情景角色扮演（${scene}）。保持角色一致，自然对话，适时嵌入目标词汇。`)
  } else {
    base.push('当前模式：自由对话。自然聊天，适时引入目标词汇。')
  }

  return base.join('\n')
}

async function generateAIResponse(
  userMessage: string,
  bookCode: string | undefined,
  history: Array<{ role: string; content: string }>,
  targetWords: string[],
  mode: ChatMode,
  scenario?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY
  if (apiKey) {
    const llm = await callLlm(userMessage, bookCode, history, targetWords, mode, scenario, apiKey)
    if (llm) return llm
  }
  return fallbackResponse(userMessage, targetWords)
}

async function callLlm(
  userMessage: string,
  bookCode: string | undefined,
  history: Array<{ role: string; content: string }>,
  targetWords: string[],
  mode: ChatMode,
  scenario: string | undefined,
  apiKey: string
): Promise<string | null> {
  const baseUrl = process.env.LLM_BASE_URL || (process.env.DEEPSEEK_API_KEY
    ? 'https://api.deepseek.com/v1'
    : 'https://api.openai.com/v1')
  const model = process.env.LLM_MODEL || (process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini')
  const system = buildSystemPrompt(bookCode, targetWords, mode, scenario)

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: system },
    ...history.slice(0, -1),
    { role: 'user', content: userMessage }
  ]

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 300
      })
    })
    if (!res.ok) return null
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}

function fallbackResponse(userMessage: string, targetWords: string[]): string {
  const greetings = ['hello', 'hi', 'hey', '你好']
  const lower = userMessage.toLowerCase()
  const hint = targetWords.length > 0 ? ` Try using: ${targetWords.slice(0, 3).join(', ')}.` : ''
  if (greetings.some(g => lower.includes(g))) {
    return `Hello! Which word would you like to practice today?${hint}`
  }
  return `Good try! You said: "${userMessage}". Can you use one vocabulary word from your book in a sentence?${hint}`
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
