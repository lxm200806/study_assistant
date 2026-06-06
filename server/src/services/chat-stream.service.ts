import type { Response } from 'express'
import { recordChatVocabulary, type MatchedWord } from './vocab-match.service'
import type { ChatMode } from './chat.service'
import {
  assertChatQuota,
  saveUserChatMessage,
  saveAiChatMessage,
  buildLlmMessages,
  buildFallbackResponse
} from './chat-context.service'
import { getLearnerChatContext } from './chat-learner-context.service'
import { getLlmApiKey } from './llm-config.service'
import { generateChatReply } from './llm-chat.service'
import { getChatRemaining } from './chat.service'
import { sanitizeFreeChatReply } from './chat-reply-sanitize.service'

function writeSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export async function streamChatMessage(
  res: Response,
  userId: string,
  content: string,
  bookCode?: string,
  mode: ChatMode = 'free',
  scenario?: string
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  if (typeof (res as { flushHeaders?: () => void }).flushHeaders === 'function') {
    (res as { flushHeaders: () => void }).flushHeaders()
  }

  try {
    await assertChatQuota(userId)
    await saveUserChatMessage(userId, content, mode)

    const messages = await buildLlmMessages(userId, content, bookCode, mode, scenario)
    let fullText = ''
    let streamedAny = false

    const llmOptions = mode === 'free' ? { temperature: 0.4 } : undefined

    if (getLlmApiKey()) {
      fullText = await generateChatReply(messages, (token) => {
        streamedAny = true
        writeSse(res, 'token', { text: token })
      }, llmOptions)
      fullText = fullText.trim()

      // Lightweight last-resort sanitize for free mode (prompt is the primary guard).
      if (mode === 'free') {
        const cleaned = sanitizeFreeChatReply(fullText, content)
        if (cleaned !== fullText && cleaned) {
          fullText = cleaned
        }
      }
    }

    const usedFallback = !fullText
    if (usedFallback) {
      const learnerContext = await getLearnerChatContext(userId, bookCode)
      fullText = buildFallbackResponse(content, learnerContext.backgroundWords, mode)
      if (!streamedAny) {
        writeSse(res, 'token', { text: fullText })
      }
    }

    await saveAiChatMessage(userId, fullText, mode)
    const matchedWords: MatchedWord[] = mode === 'challenge'
      ? await recordChatVocabulary(userId, bookCode, content, fullText)
      : []
    const quota = await getChatRemaining(userId)

    writeSse(res, 'done', {
      fullText,
      matchedWords,
      remainingFree: quota.isPremium ? undefined : quota.remaining,
      usedFallback
    })
    res.end()
  } catch (error) {
    const msg = (error as Error).message
    writeSse(res, 'error', { message: msg === 'CHAT_LIMIT' ? '今日免费对话次数已用完' : msg })
    res.end()
  }
}
