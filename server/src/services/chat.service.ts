import prisma from '../prisma/client'

const FREE_DAILY_CHAT = 5

export async function sendChatMessage(userId: string, content: string, bookCode?: string) {
  await prisma.chatRecord.create({
    data: { userId, role: 'user', content }
  })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  const isPremium = user?.plan === 'premium' && (!user.planExpiresAt || user.planExpiresAt > new Date())

  if (!isPremium) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayCount = await prisma.chatRecord.count({
      where: { userId, role: 'user', createdAt: { gte: todayStart } }
    })
    if (todayCount > FREE_DAILY_CHAT) {
      throw new Error('CHAT_LIMIT')
    }
  }

  const aiResponse = await generateAIResponse(content, bookCode)

  await prisma.chatRecord.create({
    data: { userId, role: 'ai', content: aiResponse }
  })

  return { userMessage: content, aiResponse }
}

async function generateAIResponse(userMessage: string, bookCode?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY
  if (apiKey) {
    const llm = await callLlm(userMessage, bookCode, apiKey)
    if (llm) return llm
  }
  return fallbackResponse(userMessage)
}

async function callLlm(userMessage: string, bookCode: string | undefined, apiKey: string): Promise<string | null> {
  const baseUrl = process.env.LLM_BASE_URL || (process.env.DEEPSEEK_API_KEY
    ? 'https://api.deepseek.com/v1'
    : 'https://api.openai.com/v1')
  const model = process.env.LLM_MODEL || (process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini')

  const system = bookCode
    ? `你是英语词汇学习助手。用户正在学习词书 ${bookCode}。用简洁中文+英文例句回复，帮助练口语和造句，纠正明显语法错误。`
    : '你是英语词汇学习助手。用简洁中文回复，帮助用户练习英语。'

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMessage }
        ],
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

function fallbackResponse(userMessage: string): string {
  const greetings = ['hello', 'hi', 'hey', '你好']
  const lower = userMessage.toLowerCase()
  if (greetings.some(g => lower.includes(g))) {
    return 'Hello! Which word would you like to practice today?'
  }
  return `Good try! You said: "${userMessage}". Can you use one vocabulary word from your book in a sentence?`
}

export async function getChatHistory(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit
  return prisma.chatRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit
  })
}
