import { unwrapStorage } from './storage'

export function getAuthToken(): string | null {
  const raw = uni.getStorageSync('accessToken')
  const token = unwrapStorage<string>(raw) ?? (typeof raw === 'string' ? raw : null)
  return token || null
}

export function getApiBaseUrl(): string {
  // 开发模式走 Vite 同源代理（使用完整 origin，避免 H5 相对路径异常）
  if (import.meta.env.DEV) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/api`
    }
    return '/api'
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:3004/api`
  }

  return 'http://localhost:3004/api'
}

export interface ResponseData<T = any> {
  success?: boolean
  data?: T
  error?: string
  accessToken?: string
  refreshToken?: string
  user?: {
    id: string
    username: string
  }
}

export async function request<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any,
  headers?: Record<string, string>
): Promise<ResponseData<T>> {
  const token = getAuthToken()

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  }

  const options: UniApp.RequestOptions = {
    url: getApiBaseUrl() + url,
    method,
    timeout: 120000,
    header: { ...defaultHeaders, ...headers },
    data: data ? JSON.stringify(data) : undefined
  }

  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      success: (res) => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(res.data as ResponseData<T>)
        } else {
          const body = res.data as ResponseData
          const errMsg = body?.error || 'Request failed'
          if (res.statusCode === 401) {
            reject(new Error(`Unauthorized: ${errMsg}`))
          } else if (res.statusCode === 403) {
            reject(new Error(`BOOK_LOCKED: ${errMsg}`))
          } else {
            reject(new Error(errMsg))
          }
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || 'Network error'))
      }
    })
  })
}

export const authAPI = {
  login: async (username: string, password: string) => {
    return request('/auth/login', 'POST', { username, password })
  },
  register: async (username: string, password: string) => {
    return request('/auth/register', 'POST', { username, password })
  },
  refresh: async (refreshToken: string) => {
    return request('/auth/refresh', 'POST', { refreshToken })
  },
  profile: async () => {
    return request('/auth/profile', 'GET')
  },
  onboard: async () => {
    return request('/auth/onboard', 'POST')
  },
  wechatLogin: async (code: string) => {
    return request('/auth/wechat', 'POST', { code })
  }
}

export const adminAPI = {
  missingSummary: async () => {
    return request('/admin/vocabulary/missing/summary', 'GET')
  },
  missingWords: async (
    bookCode?: string,
    page: number = 1,
    limit: number = 50,
    issueType?: 'missing_cn' | 'parse_error'
  ) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (bookCode) params.set('bookCode', bookCode)
    if (issueType) params.set('issueType', issueType)
    return request(`/admin/vocabulary/missing?${params.toString()}`, 'GET')
  }
}

export const vocabularyAPI = {
  list: async (page: number = 1, limit: number = 20) => {
    return request(`/vocabulary?page=${page}&limit=${limit}`, 'GET')
  },
  detail: async (id: string) => {
    return request(`/vocabulary/${id}`, 'GET')
  },
  random: async (count: number = 10) => {
    return request(`/vocabulary/random?count=${count}`, 'GET')
  },
  stats: async () => {
    return request('/vocabulary/stats', 'GET')
  }
}

export const trainingAPI = {
  practice: async (wordId: string, type: string, isCorrect: boolean) => {
    return request('/training/practice', 'POST', { wordId, type, isCorrect })
  },
  review: async (type?: string, bookCode?: string, limit?: number) => {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (bookCode) params.set('bookCode', bookCode)
    if (limit) params.set('limit', String(limit))
    const query = params.toString()
    return request(`/training/review${query ? `?${query}` : ''}`, 'GET')
  },
  completeSession: async (bookCode: string, wordIds: string[]) => {
    return request('/training/session/complete', 'POST', { bookCode, wordIds })
  },
  history: async (page: number = 1, limit: number = 20) => {
    return request(`/training/history?page=${page}&limit=${limit}`, 'GET')
  }
}

export const chatAPI = {
  send: async (
    content: string,
    bookCode?: string,
    mode?: 'free' | 'challenge' | 'roleplay',
    scenario?: string
  ) => {
    return request<{
      userMessage: string
      aiResponse: string
      matchedWords: Array<{ wordId: string; word: string; type: string }>
      remainingFree?: number
    }>('/chat/send', 'POST', { content, bookCode, mode, scenario })
  },
  history: async (page: number = 1, limit: number = 20) => {
    return request<Array<{ id: string; role: string; content: string; createdAt: string }>>(
      `/chat/history?page=${page}&limit=${limit}`,
      'GET'
    )
  },
  quota: async () => {
    return request<{ remaining: number; isPremium: boolean }>('/chat/quota', 'GET')
  }
}

export const speechAPI = {
  asrConfig: async () => {
    return request<{ provider: 'xfyun' | 'whisper' }>('/speech/asr/config', 'GET')
  },
  asrStartSession: async (encoding: 'lame' | 'raw' = 'lame') => {
    return request<{ sessionId: string; provider: 'xfyun' | 'whisper' }>(
      '/speech/asr/session/start',
      'POST',
      { encoding }
    )
  },
  asrPushChunk: async (sessionId: string, audioBase64: string, isLast = false) => {
    return request<{ partial: string; isFinal: boolean }>('/speech/asr/session/chunk', 'POST', {
      sessionId,
      audioBase64,
      isLast
    })
  },
  asrEndSession: async (sessionId: string) => {
    return request<{ text: string }>('/speech/asr/session/end', 'POST', { sessionId })
  },
  transcribe: async (audioBase64: string, mimeType = 'audio/mp3') => {
    return request<{ text: string }>('/speech/transcribe', 'POST', { audioBase64, mimeType })
  },
  assess: async (referenceText: string, audioBase64: string, mimeType = 'audio/mp3') => {
    return request<{ transcript: string; score: number; passed: boolean; feedback: string }>(
      '/speech/assess',
      'POST',
      { referenceText, audioBase64, mimeType }
    )
  }
}

export const bookAPI = {
  list: async () => {
    return request('/books', 'GET')
  },
  detail: async (code: string) => {
    return request(`/books/${code}`, 'GET')
  },
  random: async (code: string, count: number = 10) => {
    return request(`/books/${code}/random?count=${count}`, 'GET')
  },
  session: async (code: string, count: number = 10, mode: string = 'coverage', type?: string, topic?: string) => {
    const params = new URLSearchParams({ count: String(count), mode })
    if (type) params.set('type', type)
    if (topic) params.set('topic', topic)
    return request(`/books/${code}/session?${params.toString()}`, 'GET')
  },
  progress: async (code: string) => {
    return request(`/books/${code}/progress`, 'GET')
  },
  dueCount: async (code: string, type?: string) => {
    const typeQuery = type ? `?type=${type}` : ''
    return request(`/books/${code}/due-count${typeQuery}`, 'GET')
  }
}

export const statsAPI = {
  bookMap: async (code: string, type?: string) => {
    const typeQuery = type ? `?type=${type}` : ''
    return request(`/stats/book/${code}/map${typeQuery}`, 'GET')
  },
  globalMap: async () => {
    return request('/stats/global/map', 'GET')
  },
  daily: async () => {
    return request('/stats/daily', 'GET')
  },
  weeklyReport: async () => {
    return request('/stats/weekly-report', 'GET')
  }
}

export const quizAPI = {
  words: async (bookCode: string, count: number = 30) => {
    return request(`/training/quiz/words?bookCode=${bookCode}&count=${count}`, 'GET')
  },
  submit: async (bookCode: string, items: { wordId: string; isCorrect: boolean }[]) => {
    return request('/training/quiz/submit', 'POST', { bookCode, items })
  }
}
