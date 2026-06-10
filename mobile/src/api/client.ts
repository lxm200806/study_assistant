// API Client for Study Assistant Mobile (React Native compatible)
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

export interface ResponseData<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  accessToken?: string
  refreshToken?: string
  user?: { id: string; username: string }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const DEFAULT_TIMEOUT_MS = 120000 // 2 minutes

export function getApiBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
    'http://127.0.0.1:3004/api'
  )
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
}

export async function saveTokens(accessToken?: string, refreshToken?: string): Promise<void> {
  if (accessToken) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken)
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
}

// Token refresh mechanism
let refreshPromise: Promise<string | null> | null = null

async function refreshTokenInternal(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  if (!refreshToken) return null

  try {
    const response = await fetch(getApiBaseUrl() + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    const body = await response.json().catch(() => ({})) as ResponseData
    if (!response.ok) return null

    await saveTokens(body.accessToken, body.refreshToken)
    return body.accessToken || null
  } catch {
    return null
  }
}

export async function refreshAndRetry(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  refreshPromise = refreshTokenInternal().finally(() => { refreshPromise = null })
  return refreshPromise
}

// Request wrapper with timeout and retry
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

async function requestRaw(
  path: string,
  method: HttpMethod = 'GET',
  data?: unknown,
  maxRetries = 1
): Promise<Response> {
  const token = await getAccessToken()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        getApiBaseUrl() + path,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          body: data ? JSON.stringify(data) : undefined,
        },
        DEFAULT_TIMEOUT_MS
      )

      if (response.status === 401 && attempt === 0) {
        const newToken = await refreshAndRetry()
        if (newToken) continue
        await clearTokens()
        throw new Error('Unauthorized: session expired')
      }

      return response
    } catch (error) {
      if (attempt === 0 && maxRetries > 0) continue
      throw error
    }
  }

  throw new Error('Request failed after retries')
}

export async function request<T>(
  path: string,
  method: HttpMethod = 'GET',
  data?: unknown,
): Promise<ResponseData<T>> {
  const response = await requestRaw(path, method, data)
  const body = await response.json().catch(() => ({})) as ResponseData<T>
  if (response.ok) return body

  const error = body.error || 'Request failed: ' + response.status
  if (response.status === 401) throw new Error('Unauthorized: ' + error)
  if (response.status === 403) throw new Error('BOOK_LOCKED: ' + error)
  throw new Error(error)
}

// Auth API
export interface AuthUser {
  id: string
  username: string
}

export async function authLogin(username: string, password: string): Promise<ResponseData<{ accessToken: string; refreshToken: string }>> {
  return request('/auth/login', 'POST', { username, password })
}

export async function authRegister(username: string, password: string): Promise<ResponseData> {
  return request('/auth/register', 'POST', { username, password })
}

export async function authProfile(): Promise<ResponseData<{ id: string; username: string }>> {
  return request('/auth/profile', 'GET')
}

export async function authOnboard(): Promise<ResponseData> {
  return request('/auth/onboard', 'POST')
}

// Books API
export interface Book {
  id: string
  code: string
  name: string
  description: string
  level: string
  wordCount: number
  isFree?: boolean
}

export async function listBooks(): Promise<ResponseData<Book[]>> {
  return request('/books', 'GET')
}

// Vocabulary API
export interface WordEntry {
  id: string
  word: string
  meaning: string
  phonetic?: string
  example?: string
  image?: string
}

export async function listVocabulary(page = 1, limit = 40): Promise<ResponseData<WordEntry[]>> {
  return request(/vocabulary/list?page=&limit=, 'GET')
}

// Training API
export async function submitPractice(wordId: string, type: string, isCorrect: boolean) {
  return request('/training/practice', 'POST', { wordId, type, isCorrect })
}

export async function getSessionReview(type?: string, bookCode?: string, limit = 5) {
  const params = new URLSearchParams()
  if (type) params.set('type', type)
  if (bookCode) params.set('bookCode', bookCode)
  params.set('limit', String(limit))
  return request(/training/review?, 'GET')
}

export async function completeSession(bookCode: string, wordIds: string[]) {
  return request('/training/session/complete', 'POST', { bookCode, wordIds })
}

// Stats API
export async function loadDailyStats(): Promise<ResponseData<{ date: string; wordCount: number; goal: number; streak: number }>> {
  return request('/stats/daily', 'GET')
}

// Membership API
export async function getMembershipInfo() {
  return request('/membership/info', 'GET')
}

// Quiz API
export interface QuizWord {
  id: string
  word: string
  phonetic?: string
  meaning?: string
}

export async function getQuizWords(bookCode: string, count = 30) {
  return request(/training/quiz/words?bookCode=&count=, 'GET')
}

export async function submitQuizAnswers(bookCode: string, items: Array<{ wordId: string; isCorrect: boolean }>) {
  return request('/training/quiz/submit', 'POST', { bookCode, items })
}

