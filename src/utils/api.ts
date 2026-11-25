import { isBrowserH5 } from '@/platform/runtime'
import { getStored, removeStored, setStored } from '@/platform/storage'

export function getAuthToken(): string | null {
  return getStored<string>('accessToken') || null
}

export function getApiBaseUrl(): string {
  // Dev: Vite proxy; Prod: Nginx proxies /api → backend (same origin).
  const configured = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (isBrowserH5()) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/api`
    }
    return import.meta.env.DEV ? '/api' : ''
  }
  // 非 H5（小程序/App）没有同源概念，必须显式配置 VITE_API_BASE
  return ''
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
    isAdmin?: boolean
    hasOnboarded?: boolean
    plan?: string
    activeSubject?: string
    accountType?: string
    displayName?: string
    activeLearnerId?: string | null
    activeRole?: string
    learner?: { id: string; name: string; activeSubject?: string } | null
    children?: Array<{ id: string; name: string; activeSubject?: string }>
  }
  learner?: { id: string; name: string; activeSubject?: string }
}

/** 登录相关接口的 401 是账号密码错误，不要当成会话过期 */
const AUTH_CREDENTIAL_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/wechat'
])

let sessionExpiredPromptOpen = false
let networkHintAt = 0
let refreshInFlight: Promise<boolean> | null = null
let refreshFailedByNetwork = false

type ApiError = Error & { status?: number; network?: boolean }

function apiError(message: string, status?: number): ApiError {
  const error = new Error(message) as ApiError
  if (status != null) error.status = status
  return error
}

function networkError(message: string): ApiError {
  const error = apiError(message)
  error.network = true
  return error
}

function clearLocalSession() {
  removeStored('accessToken')
  removeStored('refreshToken')
  removeStored('user')
}

function currentRoutePath(): string {
  try {
    const pages = getCurrentPages()
    const cur = pages[pages.length - 1] as { route?: string } | undefined
    return cur?.route ? `/${cur.route}` : ''
  } catch {
    return ''
  }
}

/** 会话失效：清本地登录态，弹窗后进登录页（全局只弹一次） */
export function promptSessionExpired(message = '登录已失效，请重新登录后再继续。') {
  if (sessionExpiredPromptOpen) return
  const path = currentRoutePath()
  if (path.includes('/pages/login/login') || path.includes('/pages/register/register')) {
    clearLocalSession()
    return
  }
  sessionExpiredPromptOpen = true
  clearLocalSession()
  uni.showModal({
    title: '需要重新登录',
    content: message,
    showCancel: false,
    confirmText: '去登录',
    success: () => {
      uni.reLaunch({
        url: '/pages/login/login',
        complete: () => {
          sessionExpiredPromptOpen = false
        }
      })
    },
    fail: () => {
      sessionExpiredPromptOpen = false
      uni.reLaunch({ url: '/pages/login/login' })
    }
  })
}

function hintServerUnavailable() {
  const now = Date.now()
  if (now - networkHintAt < 4000) return
  networkHintAt = now
  uni.showToast({
    title: '网络连接异常，请稍后重试',
    icon: 'none',
    duration: 2800
  })
}

function getRefreshToken(): string | null {
  return getStored<string>('refreshToken') || null
}

export async function tryRefreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  if (refreshInFlight) return refreshInFlight

  refreshFailedByNetwork = false
  refreshInFlight = (async () => {
    try {
      const result = await request('/auth/refresh', 'POST', { refreshToken }, undefined, {
        skipAuthHandler: true
      })
      if (result.accessToken) {
        setStored('accessToken', result.accessToken)
        if (result.refreshToken) setStored('refreshToken', result.refreshToken)
        return true
      }
      return false
    } catch (error) {
      const failure = error as ApiError
      refreshFailedByNetwork = !!failure.network || (failure.status ?? 0) >= 500
      return false
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

type RequestOptions = {
  skipAuthHandler?: boolean
  /** 内部重试标记，避免刷新后无限递归 */
  _retried?: boolean
}

export async function request<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any,
  headers?: Record<string, string>,
  options: RequestOptions = {}
): Promise<ResponseData<T>> {
  const baseUrl = getApiBaseUrl()
  if (!baseUrl) {
    throw apiError('未配置 API 地址：请设置 VITE_API_BASE 环境变量', 0)
  }
  const token = getAuthToken()

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  }

  const req: UniApp.RequestOptions = {
    url: baseUrl + url,
    method,
    timeout: 30000,
    header: { ...defaultHeaders, ...headers },
    data: data ? JSON.stringify(data) : undefined
  }

  return new Promise((resolve, reject) => {
    uni.request({
      ...req,
      success: async (res) => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(res.data as ResponseData<T>)
          return
        }

        const body = res.data as ResponseData
        const errMsg = body?.error || 'Request failed'

        if (res.statusCode === 401) {
          const isCredentialCall = AUTH_CREDENTIAL_PATHS.has(url)
          if (!options.skipAuthHandler && !isCredentialCall) {
            if (!options._retried) {
              const refreshed = await tryRefreshAccessToken()
              if (refreshed) {
                try {
                  resolve(await request<T>(url, method, data, headers, { ...options, _retried: true }))
                  return
                } catch (retryErr) {
                  reject(retryErr)
                  return
                }
              }
              // 网络/服务端故障时不要清登录态，只有 refresh token 明确失效才登出
              if (refreshFailedByNetwork) {
                reject(networkError('Network error'))
                return
              }
            }
            promptSessionExpired()
          }
          reject(apiError(`Unauthorized: ${errMsg}`, 401))
          return
        }

        if (res.statusCode === 403) {
          reject(apiError(`BOOK_LOCKED: ${errMsg}`, 403))
          return
        }

        reject(apiError(errMsg, res.statusCode))
      },
      fail: (err) => {
        hintServerUnavailable()
        reject(networkError(err.errMsg || 'Network error'))
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
  onboard: async (subject?: string) => {
    const body: Record<string, string> = {}
    if (subject) body.subject = subject
    return request('/auth/onboard', 'POST', body)
  },
  setSubject: async (subject: string) => {
    return request('/auth/subject', 'PUT', { subject })
  },
  setRole: async (role: 'parent' | 'student', studentId?: string) => {
    return request('/auth/role', 'PUT', { role, studentId })
  },
  students: async () => {
    return request('/auth/students', 'GET')
  },
  createStudent: async (name: string) => {
    return request('/auth/students', 'POST', { name })
  },
  setActiveStudent: async (studentId: string) => {
    return request('/auth/students/active', 'PUT', { studentId })
  },
  renameStudent: async (id: string, name: string) => {
    return request(`/auth/students/${id}`, 'PUT', { name })
  },
  archiveStudent: async (id: string) => {
    return request(`/auth/students/${id}`, 'DELETE')
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
    return request(`/vocab?page=${page}&limit=${limit}`, 'GET')
  },
  detail: async (id: string) => {
    return request(`/vocab/${id}`, 'GET')
  },
  random: async (count: number = 10) => {
    return request(`/vocab/random?count=${count}`, 'GET')
  },
  stats: async () => {
    return request('/vocab/stats', 'GET')
  }
}

export const trainingAPI = {
  practice: async (wordId: string, type: string, isCorrect: boolean) => {
    return request('/training/practice', 'POST', { wordId, type, isCorrect })
  },
  recheck: async (bookCode: string, wordId: string, type: string, isCorrect: boolean) => {
    return request('/training/recheck', 'POST', { bookCode, wordId, type, isCorrect })
  },
  review: async (type?: string, bookCode?: string, limit?: number) => {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (bookCode) params.set('bookCode', bookCode)
    if (limit) params.set('limit', String(limit))
    const query = params.toString()
    return request(`/training/review${query ? `?${query}` : ''}`, 'GET')
  },
  completeSession: async (bookCode: string, wordIds: string[], sessionTokens: string[] = []) => {
    return request('/training/session/complete', 'POST', { bookCode, wordIds, sessionTokens })
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
  session: async (
    code: string,
    count: number = 10,
    mode: string = 'coverage',
    type?: string,
    topic?: string,
    opts?: { unit?: string; excludeIds?: string[] }
  ) => {
    const params = new URLSearchParams({ count: String(count), mode })
    if (type) params.set('type', type)
    if (topic) params.set('topic', topic)
    if (opts?.unit) params.set('unit', opts.unit)
    if (opts?.excludeIds?.length) params.set('exclude', opts.excludeIds.join(','))
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
    // Mounted on /api/vocab (see server vocab.routes + app.ts)
    return request(`/vocab/maps/book/${encodeURIComponent(code)}${typeQuery}`, 'GET')
  },
  globalMap: async () => {
    return request('/vocab/maps/global?limit=8000', 'GET')
  },
  daily: async () => {
    return request('/stats/daily', 'GET')
  },
  weeklyReport: async () => {
    return request('/stats/weekly-report', 'GET')
  }
}

export const typingAPI = {
  summary: (bookCode: string, mode = 'follow') =>
    request(`/typing/summary?bookCode=${encodeURIComponent(bookCode)}&mode=${encodeURIComponent(mode)}`, 'GET'),
  queue: (options: {
    bookCode?: string
    source: string
    count: number
    listId?: string
    mode?: string
    includeMastered?: boolean
    allBooks?: boolean
  }) => {
    const params = new URLSearchParams({ source: options.source, count: String(options.count) })
    if (options.bookCode) params.set('bookCode', options.bookCode)
    if (options.listId) params.set('listId', options.listId)
    if (options.mode) params.set('mode', options.mode)
    if (options.includeMastered) params.set('includeMastered', '1')
    if (options.allBooks) params.set('allBooks', '1')
    return request(`/typing/queue?${params.toString()}`, 'GET')
  },
  answer: (wordId: string, isCorrect: boolean, mode = 'follow') =>
    request('/typing/answer', 'POST', { wordId, isCorrect, mode }),
  mark: (wordId: string, patch: { favorite?: boolean; skipMastered?: boolean }) =>
    request('/typing/marks', 'PUT', { wordId, ...patch }),
  activity: (count: number) => request('/typing/activity', 'POST', { count }),
  lists: () => request('/typing/lists', 'GET'),
  createList: (name: string, text: string) => request('/typing/lists', 'POST', { name, text }),
  deleteList: (id: string) => request(`/typing/lists/${id}`, 'DELETE'),
  articles: () => request('/typing/articles', 'GET'),
  createArticle: (title: string, body: string, translation: string) =>
    request('/typing/articles', 'POST', { title, body, translation }),
  article: (id: string) => request(`/typing/articles/${encodeURIComponent(id)}`, 'GET'),
  updateArticle: (id: string, title: string, body: string, translation: string) =>
    request(`/typing/articles/${encodeURIComponent(id)}`, 'PUT', { title, body, translation }),
  previewArticle: (id: string, body: string, translation: string) =>
    request(`/typing/articles/${encodeURIComponent(id)}/preview`, 'POST', { body, translation }),
  deleteArticle: (id: string) => request(`/typing/articles/${encodeURIComponent(id)}`, 'DELETE'),
  articleAnswer: (articleKey: string, sentenceIndex: number, isCorrect: boolean, linear = false) =>
    request('/typing/articles/answer', 'POST', { articleKey, sentenceIndex, isCorrect, linear }),
  history: (end: string) => request(`/typing/history?end=${encodeURIComponent(end)}&days=112`, 'GET'),
  session: (body: {
    date: string
    durationMs: number
    typedChars: number
    correctChars: number
    itemCount: number
    correctCount: number
    kind: 'words' | 'article'
  }) => request('/typing/sessions', 'POST', body)
}

export const quizAPI = {
  words: async (bookCode: string, count: number = 30) => {
    return request(`/training/quiz/words?bookCode=${bookCode}&count=${count}`, 'GET')
  },
  submit: async (bookCode: string, items: { wordId: string; isCorrect: boolean }[]) => {
    return request('/training/quiz/submit', 'POST', { bookCode, items })
  }
}

export const chineseAPI = {
  meta: () => request('/chinese/meta', 'GET'),
  library: (query = '') => request(`/chinese/library${query ? `?${query}` : ''}`, 'GET'),
  coverage: () => request('/chinese/library/coverage', 'GET'),
  courses: () => request('/chinese/courses', 'GET'),
  previewCourse: (body: Record<string, unknown>) => request('/chinese/courses/preview', 'POST', body),
  createCourse: (body: Record<string, unknown>) => request('/chinese/courses', 'POST', body),
  patchCourse: (id: string, body: Record<string, unknown>) => request(`/chinese/courses/${id}`, 'PUT', body),
  deleteCourse: (id: string) => request(`/chinese/courses/${id}`, 'DELETE'),
  syncCourse: (id: string) => request(`/chinese/courses/${id}/sync`, 'POST'),
  today: (id: string, mode?: string, options?: { extraMinutes?: number; reciteOffset?: number }) => {
    const params = new URLSearchParams()
    if (mode) params.set('mode', mode)
    if (options?.extraMinutes) params.set('extraMinutes', String(options.extraMinutes))
    if (options?.reciteOffset) params.set('reciteOffset', String(options.reciteOffset))
    const query = params.toString()
    return request(`/chinese/courses/${id}/today${query ? `?${query}` : ''}`, 'GET')
  },
  plan: (id: string) => request(`/chinese/courses/${id}/plan`, 'GET'),
  review: (id: string, body: Record<string, unknown>) => request(`/chinese/courses/${id}/review`, 'POST', body),
  stats: (id: string) => request(`/chinese/courses/${id}/stats`, 'GET'),
  resources: () => request('/chinese/resources', 'GET'),
  resource: (id: string) => request(`/chinese/resources/${id}`, 'GET'),
  syncResource: (id: string) => request(`/chinese/resources/${id}/sync`, 'POST'),
  syncIncremental: () => request('/chinese/resources/sync-incremental', 'POST'),
  syncAll: () => request('/chinese/resources/sync-all', 'POST'),
  seed: () => request('/chinese/resources/seed', 'POST'),
  drafts: (query = '') => request(`/chinese/drafts${query ? `?${query}` : ''}`, 'GET'),
  importDrafts: (body: Record<string, unknown>) => request('/chinese/drafts/import', 'POST', body),
  patchDraft: (id: string, body: Record<string, unknown>) => request(`/chinese/drafts/${id}`, 'PUT', body),
  publishDraft: (id: string) => request(`/chinese/drafts/${id}/publish`, 'POST'),
  publishDrafts: (ids: string[]) => request('/chinese/drafts/publish-batch', 'POST', { ids }),
  patchPoint: (id: string, body: Record<string, unknown>) => request(`/chinese/library/${id}`, 'PUT', body)
}
