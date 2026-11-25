import { getApiBaseUrl, getAuthToken, tryRefreshAccessToken } from '@/utils/api'
import { isBrowserH5 } from './runtime'

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

/**
 * H5 使用 fetch + ReadableStream 读 SSE。
 * 小程序/App 目前没有统一的流式 HTTP 实现，降级为普通 /chat/send，
 * 一次性把完整回复交给页面；后续可在本文件补 uni.request 分块实现。
 */
export async function streamChatMessage(options: ChatStreamOptions): Promise<void> {
  if (isBrowserH5() && typeof fetch === 'function' && typeof AbortController !== 'undefined') {
    await streamViaFetch(options)
    return
  }
  await streamViaUniRequest(options)
}

async function streamViaFetch(options: ChatStreamOptions): Promise<void> {
  const baseUrl = getApiBaseUrl()
  if (!baseUrl) {
    options.onError('未配置 API 地址：请设置 VITE_API_BASE 环境变量')
    return
  }

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
    fetch(`${baseUrl}/chat/stream`, {
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
      // 浏览器不支持 ReadableStream 时退回普通请求，避免直接失败。
      await streamViaUniRequest(options)
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

function parseBody(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
}

async function streamViaUniRequest(options: ChatStreamOptions): Promise<void> {
  const baseUrl = getApiBaseUrl()
  if (!baseUrl) {
    options.onError('未配置 API 地址：请设置 VITE_API_BASE 环境变量')
    return
  }

  const post = (token: string | null) =>
    new Promise<{ statusCode: number; data: unknown }>((resolve, reject) => {
      uni.request({
        url: `${baseUrl}/chat/send`,
        method: 'POST',
        timeout: STREAM_IDLE_TIMEOUT_MS,
        header: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        data: {
          content: options.content,
          bookCode: options.bookCode,
          mode: options.mode || 'free',
          scenario: options.scenario
        },
        success: res => resolve({ statusCode: res.statusCode, data: res.data }),
        fail: err => reject(new Error(err.errMsg || '网络异常，请稍后重试'))
      })
    })

  try {
    let response = await post(getAuthToken())
    if (response.statusCode === 401) {
      const refreshed = await tryRefreshAccessToken()
      if (refreshed) response = await post(getAuthToken())
    }

    const payload = parseBody(response.data)
    // /chat/send 返回 { success, data }；兼容未来直接返回结果对象的情况。
    const body =
      payload.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : payload

    if (response.statusCode >= 200 && response.statusCode < 300) {
      const text = String(body.aiResponse || '')
      if (!text) {
        options.onError('回复为空，请稍后重试')
        return
      }
      options.onToken(text)
      options.onDone({
        fullText: text,
        matchedWords: Array.isArray(body.matchedWords)
          ? (body.matchedWords as ChatStreamDonePayload['matchedWords'])
          : [],
        remainingFree:
          typeof body.remainingFree === 'number' ? body.remainingFree : undefined,
        usedFallback: Boolean(body.usedFallback)
      })
      return
    }

    options.onError(String(payload.error || `Request failed (${response.statusCode})`))
  } catch (error) {
    options.onError((error as Error)?.message || '网络异常，请稍后重试')
  }
}
