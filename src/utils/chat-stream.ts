import { getApiBaseUrl, getAuthToken, tryRefreshAccessToken } from '@/utils/api'

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

const STREAM_IDLE_TIMEOUT_MS = 45_000

export async function streamChatMessage(options: ChatStreamOptions): Promise<void> {
  let settled = false
  const finish = (payload: ChatStreamDonePayload) => {
    if (settled) return
    settled = true
    options.onDone(payload)
  }
  const fail = (message: string) => {
    if (settled) return
    settled = true
    options.onError(message)
  }

  const controller = new AbortController()
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  const armIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS)
  }

  const open = (token: string | null) =>
    fetch(`${getApiBaseUrl()}/chat/stream`, {
      method: 'POST',
      signal: controller.signal,
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

  try {
    armIdleTimer()
    let response = await open(getAuthToken())
    if (response.status === 401) {
      const refreshed = await tryRefreshAccessToken()
      if (refreshed) {
        armIdleTimer()
        response = await open(getAuthToken())
      }
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string }
      fail(body.error || `Stream request failed (${response.status})`)
      return
    }

    if (!response.body) {
      fail('当前环境不支持流式回复，请稍后重试')
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = 'message'
    let fullText = ''

    while (true) {
      armIdleTimer()
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
            fullText += String(data.text)
            options.onToken(data.text)
          } else if (currentEvent === 'done') {
            const donePayload = data as ChatStreamDonePayload
            finish({
              ...donePayload,
              fullText: donePayload.fullText || fullText,
              matchedWords: donePayload.matchedWords || []
            })
          } else if (currentEvent === 'error') {
            fail(data.message || 'Stream error')
          }
        } catch {
          // ignore malformed SSE payloads
        }
      }
      if (settled) break
    }

    if (!settled) {
      if (fullText.trim()) {
        finish({ fullText, matchedWords: [] })
      } else {
        fail('回复中断，请稍后重试')
      }
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      fail('回复超时，请稍后重试')
    } else {
      fail((error as Error)?.message || '网络异常，请稍后重试')
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer)
  }
}
