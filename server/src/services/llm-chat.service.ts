import { getLlmApiKey, getLlmBaseUrl, getLlmModel } from './llm-config.service'

export interface ChatMessage {
  role: string
  content: string
}

function isLocalLlmUrl(baseUrl: string): boolean {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\./i.test(baseUrl)
}

export function buildChatCompletionBody(
  messages: ChatMessage[],
  stream: boolean,
  options?: { temperature?: number }
): Record<string, unknown> {
  const baseUrl = getLlmBaseUrl()
  const body: Record<string, unknown> = {
    model: getLlmModel(),
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: 600,
    stream
  }
  // Qwen3 等推理模型在 LM Studio 下默认只输出 reasoning_content，需关闭 thinking
  if (isLocalLlmUrl(baseUrl)) {
    body.chat_template_kwargs = { enable_thinking: false }
  }
  return body
}

function extractDeltaText(delta: { content?: string; reasoning_content?: string } | undefined): string {
  if (!delta) return ''
  // 仅向用户展示正式回复，不展示模型内部推理过程
  return delta.content || ''
}

function extractMessageText(message: { content?: string; reasoning_content?: string } | undefined): string {
  if (!message) return ''
  return (message.content || '').trim()
}

export async function completeChat(
  messages: ChatMessage[],
  options?: { temperature?: number }
): Promise<string | null> {
  const apiKey = getLlmApiKey()
  if (!apiKey) return null

  try {
    const res = await fetch(`${getLlmBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(buildChatCompletionBody(messages, false, options))
    })
    if (!res.ok) {
      console.error('[llm-chat] completion failed:', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>
    }
    return extractMessageText(data.choices?.[0]?.message) || null
  } catch (error) {
    console.error('[llm-chat] completion error:', (error as Error).message)
    return null
  }
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  onToken: (text: string) => void,
  options?: { temperature?: number }
): Promise<string> {
  const apiKey = getLlmApiKey()
  if (!apiKey) return ''

  const llmRes = await fetch(`${getLlmBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(buildChatCompletionBody(messages, true, options))
  })

  if (!llmRes.ok || !llmRes.body) {
    console.error('[llm-chat] stream failed:', llmRes.status)
    return ''
  }

  let fullText = ''
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
          choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>
        }
        const delta = extractDeltaText(json.choices?.[0]?.delta)
        if (delta) {
          fullText += delta
          onToken(delta)
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }

  return fullText.trim()
}

export async function generateChatReply(
  messages: ChatMessage[],
  onToken?: (text: string) => void,
  options?: { temperature?: number }
): Promise<string> {
  if (onToken) {
    const streamed = await streamChatCompletion(messages, onToken, options)
    if (streamed) return streamed
  } else {
    const completed = await completeChat(messages, options)
    if (completed) return completed
  }
  return (await completeChat(messages, options)) || ''
}
