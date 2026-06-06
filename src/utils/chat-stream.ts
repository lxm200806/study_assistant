import { getApiBaseUrl, getAuthToken } from '@/utils/api'

export type ChatStreamMode = 'free' | 'challenge' | 'roleplay'

export interface ChatStreamDonePayload {
  fullText: string
  matchedWords: Array<{ wordId: string; word: string; type: string }>
  remainingFree?: number
  usedFallback?: boolean
}

export interface ChatStreamOptions {
  content: string
  bookCode?: string
  mode?: ChatStreamMode
  scenario?: string
  onToken: (text: string) => void
  onDone: (payload: ChatStreamDonePayload) => void
  onError: (message: string) => void
}

export async function streamChatMessage(options: ChatStreamOptions): Promise<void> {
  const token = getAuthToken()
  const response = await fetch(`${getApiBaseUrl()}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      content: options.content,
      bookCode: options.bookCode,
      mode: options.mode || 'free',
      scenario: options.scenario
    })
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || 'Stream request failed')
  }

  if (!response.body) {
    throw new Error('Stream not supported')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = 'message'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim()
        continue
      }
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload) continue
      try {
        const data = JSON.parse(payload)
        if (currentEvent === 'token' && data.text) {
          options.onToken(data.text)
        } else if (currentEvent === 'done') {
          options.onDone(data as ChatStreamDonePayload)
        } else if (currentEvent === 'error') {
          options.onError(data.message || 'Stream error')
        }
      } catch {
        // ignore
      }
    }
  }
}
