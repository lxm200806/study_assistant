import type { Response } from 'express'
import { recordChatVocabulary, type MatchedWord } from './vocab-match.service'
import type { ChatMode } from './chat.service'
import {
  assertChatQuota,
  saveUserChatMessage,
  saveAiChatMessage,
  buildLlmMessages,
  buildFallbackResponse,
  resolveTargetWords
} from './chat-context.service'
import { getLlmApiKey, getLlmBaseUrl, getLlmModel } from './llm-config.service'
import { getChatRemaining } from './chat.service'

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

    const apiKey = getLlmApiKey()
    const messages = await buildLlmMessages(userId, content, bookCode, mode, scenario)
    let fullText = ''

    if (!apiKey) {
      const targetWords = await resolveTargetWords(userId, bookCode)
      fullText = buildFallbackResponse(content, targetWords)
      writeSse(res, 'token', { text: fullText })
    } else {
      const llmRes = await fetch(`${getLlmBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: getLlmModel(),
          messages,
          temperature: 0.7,
          max_tokens: 400,
          stream: true
        })
      })

      if (!llmRes.ok || !llmRes.body) {
        const targetWords = await resolveTargetWords(userId, bookCode)
        fullText = buildFallbackResponse(content, targetWords)
        writeSse(res, 'token', { text: fullText })
      } else {
        const reader = llmRes.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const payload = trimmed.slice(5).trim()
            if (payload === '[DONE]') continue
            try {
              const json = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>
              }
              const delta = json.choices?.[0]?.delta?.content
              if (delta) {
                fullText += delta
                writeSse(res, 'token', { text: delta })
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
      }
    }

    fullText = fullText.trim()
    if (!fullText) {
      const targetWords = await resolveTargetWords(userId, bookCode)
      fullText = buildFallbackResponse(content, targetWords)
      writeSse(res, 'token', { text: fullText })
    }

    await saveAiChatMessage(userId, fullText, mode)
    const matchedWords: MatchedWord[] = await recordChatVocabulary(userId, bookCode, content, fullText)
    const quota = await getChatRemaining(userId)

    writeSse(res, 'done', { fullText, matchedWords, remainingFree: quota.isPremium ? undefined : quota.remaining })
    res.end()
  } catch (error) {
    const msg = (error as Error).message
    writeSse(res, 'error', { message: msg === 'CHAT_LIMIT' ? '今日免费对话次数已用完' : msg })
    res.end()
  }
}
