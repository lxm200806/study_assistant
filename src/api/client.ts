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
  code?: string
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
let lastRequestId = ''

export function getLastRequestId(): string {
  return lastRequestId
}

type ApiError = Error & { status?: number; network?: boolean; code?: string }

function apiError(message: string, status?: number, code?: string): ApiError {
  const error = new Error(message) as ApiError
  if (status != null) error.status = status
  if (code) error.code = code
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
        const headers = (res.header || {}) as Record<string, string>
        const requestId = headers['X-Request-Id'] || headers['x-request-id'] || ''
        if (requestId) lastRequestId = String(requestId)

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
          const code = body?.code === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED' : 'BOOK_LOCKED'
          reject(apiError(`${code}: ${errMsg}`, 403, code))
          return
        }

        const suffix = res.statusCode >= 500 && requestId ? `（请求 ${requestId}）` : ''
        reject(apiError(`${errMsg}${suffix}`, res.statusCode))
      },
      fail: (err) => {
        hintServerUnavailable()
        reject(networkError(err.errMsg || 'Network error'))
      }
    })
  })
}

/** 直返响应（登录 token、语文接口等）使用：调用方拿到的是响应体本身，不是 data 包裹。 */
export function requestDirect<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: unknown,
  headers?: Record<string, string>,
  options: RequestOptions = {}
): Promise<T> {
  return request(url, method, data, headers, options) as unknown as Promise<T>
}
