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

// ========== Token Refresh Mechanism ==========
let refreshPromise: Promise<string | null> | null = null

async function refreshTokenInternal(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  if (!refreshToken) return null

  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    const body = await response.json().catch(() => ({})) as ResponseData
    if (!response.ok) return null

    // Save new tokens and continue
    await saveTokens(body.accessToken, body.refreshToken)
    return body.accessToken || null
  } catch {
    return null
  }
}

export async function refreshAndRetry(): Promise<string | null> {
  // Prevent multiple concurrent refresh calls
  if (refreshPromise) return refreshPromise
  refreshPromise = refreshTokenInternal().finally(() => { refreshPromise = null })
  return refreshPromise
}

// ========== Timeout Fetch Wrapper ==========
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

// ========== Request Layer with Retry & Timeout ==========
async function requestRaw(
  path: string,
  method: HttpMethod = 'GET',
  data?: unknown,
  maxRetries = 1 // Allow 1 retry after token refresh
): Promise<Response> {
  const token = await getAccessToken()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `${getApiBaseUrl()}${path}`,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: data ? JSON.stringify(data) : undefined,
        },
        DEFAULT_TIMEOUT_MS
      )

      // If 401 and we haven't tried refreshing yet, retry once
      if (response.status === 401 && attempt === 0) {
        const newToken = await refreshAndRetry()
        if (newToken) {
          continue // Retry with new token
        } else {
          // Refresh failed — clear tokens and let caller handle it
          await clearTokens()
          throw new Error('Unauthorized: session expired')
        }
      }

      return response
    } catch (error) {
      // Network error or timeout — retry once if first attempt failed
      if (attempt === 0 && maxRetries > 0) {
        continue
      }
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

  const error = body.error || `Request failed: ${response.status}`
  if (response.status === 401) throw new Error(`Unauthorized: ${error}`)
  if (response.status === 403) throw new Error(`BOOK_LOCKED: ${error}`)
  throw new Error(error)
}

// ========== Auth API ==========
export interface AuthUser {
  id: string
  username: string
}

export async function authLogin(username: string, password: string): Promise<ResponseData<{ accessToken: string; refreshToken: string; user: AuthUser }>> {
  return request('/auth/login', 'POST', { username, password })
}

export async function authRegister(username: string, password: string): Promise<ResponseData<{ accessToken: string; refreshToken: string; user: AuthUser }>> {
  return request('/auth/register', 'POST', { username, password })
}

export async function authRefresh(refreshToken: string): Promise<ResponseData<{ accessToken: string; refreshToken: string }>> {
  return request('/auth/refresh', 'POST', { refreshToken })
}

export async function authProfile(): Promise<ResponseData<AuthUser>> {
  return request('/auth/profile', 'GET')
}

export async function authOnboard(): Promise<void> {
  await request('/auth/onboard', 'POST')
}

// ========== Books API ==========
export interface Book {
  code: string
  name: string
  description?: string
  level?: string
  wordCount?: number
  isFree?: boolean
}

export async function listBooks(): Promise<ResponseData<Book[]>> {
  return request('/books', 'GET')
}

export async function getBookDetail(code: string): Promise<ResponseData<Book>> {
  return request(`/books/${code}`, 'GET')
}

export async function getBookProgress(code: string): Promise<ResponseData<{ bookCode: string; totalWords: number; masteredWords: number; practicedWords: number; dueWords: number }>> {
  return request(`/books/${code}/progress`, 'GET')
}

export async function getBookDueCount(code: string, type?: string): Promise<ResponseData<{ dueCount: number; overdueCount: number }>> {
  const qs = type ? `?type=${type}` : ''
  return request(`/books/${code}/due-count${qs}`, 'GET')
}

export async function loadBookSession(code: string, count: number = 10, mode: string = 'coverage', type?: string, topic?: string): Promise<ResponseData<{ words: Book[]; progress: any }>> {
  const params = new URLSearchParams({ count: String(count), mode })
  if (type) params.set('type', type)
  if (topic) params.set('topic', topic)
  return request(`/books/${code}/session?${params.toString()}`, 'GET')
}

export async function loadRandomWords(count = 10): Promise<ResponseData<Book[]>> {
  return request(`/vocabulary/random?count=${count}`, 'GET')
}

// ========== Vocabulary API ==========
export interface WordEntry extends Book {
  word: string
  phonetic?: string
  meaning?: string
  mastery?: number
  count?: number
  correctCount?: number
  lastPractice?: number
}

export async function listVocabulary(page = 1, limit = 40): Promise<ResponseData<WordEntry[]>> {
  return request(`/vocabulary?page=${page}&limit=${limit}`, 'GET')
}

// ========== Stats API ==========
export interface MasterySummary {
  totalUniqueWords: number
  masteredWords: number
  learningWords: number
  notStartedWords: number
}

export interface VocabularyMapData {
  book?: { name: string; wordCount: number }
  summary: MasterySummary
  byContentType: Array<{ category: string; count: number }>
  byTopic: Array<{ topic: string; count: number }>
  weakestTopics: Array<{ topic: string; score: number }>
  words: Array<{ word: string; mastery: number; phonetic?: string; meaning?: string; type?: string }>
}

export async function loadBookMap(code: string, type?: string): Promise<ResponseData<VocabularyMapData>> {
  const qs = type ? `?type=${type}` : ''
  return request(`/stats/book/${code}/map${qs}`, 'GET')
}

export async function loadGlobalMap(): Promise<ResponseData<VocabularyMapData>> {
  return request('/stats/global/map', 'GET')
}

export async function loadDailyStats(): Promise<ResponseData<{ date: string; wordCount: number; goal: number; streak: number; progress: number }>> {
  return request('/stats/daily', 'GET')
}

// ========== Training API ==========
export interface TrainingRecord {
  id: string
  type: 'listening' | 'speaking' | 'reading' | 'writing' | 'recognition' | 'spelling' | 'quiz'
  wordId?: string
  word?: string
  correct?: boolean
  timestamp: number
}

export async function submitPractice(wordId: string, type: string, isCorrect: boolean): Promise<ResponseData<{ practiceCount: number; mastery: number }>> {
  return request('/training/practice', 'POST', { wordId, type, isCorrect })
}

export async function getSessionReview(type?: string, bookCode?: string, limit = 5): Promise<ResponseData<TrainingRecord[]>> {
  const params = new URLSearchParams()
  if (type) params.set('type', type)
  if (bookCode) params.set('bookCode', bookCode)
  params.set('limit', String(limit))
  return request(`/training/review?${params.toString()}`, 'GET')
}

export async function completeSession(bookCode: string, wordIds: string[]): Promise<ResponseData<{ words: Array<{ wordId: string; type: string }> }>> {
  return request('/training/session/complete', 'POST', { bookCode, wordIds })
}

// ========== Chat API (extends existing) ==========
export async function getChatQuota(): Promise<ResponseData<{ remaining: number; isPremium: boolean }>> {
  return request('/chat/quota', 'GET')
}

export interface QuizWord {
  id: string
  word: string
  phonetic?: string
  meaning?: string
  options: Array<{ text: string; correct: boolean }>
}

// ========== Quiz API ==========
export async function getQuizWords(bookCode: string, count = 30): Promise<ResponseData<QuizWord[]>> {
  return request(`/training/quiz/words?bookCode=${bookCode}&count=${count}`, 'GET')
}

export async function submitQuizAnswers(bookCode: string, items: Array<{ wordId: string; isCorrect: boolean }>): Promise<ResponseData<{ score: number; total: number; results: Array<{ wordId: string; word: string; isCorrect: boolean }> }>> {
  return request('/training/quiz/submit', 'POST', { bookCode, items })
}

// ========== Speech API ==========
export async function getAsrConfig(): Promise<ResponseData<{ provider: 'xfyun' | 'whisper' }>> {
  return request('/speech/asr/config', 'GET')
}

export async function startAsrSession(encoding: 'lame' | 'raw' = 'lame'): Promise<ResponseData<{ sessionId: string; provider: 'xfyun' | 'whisper' }>> {
  return request('/speech/asr/session/start', 'POST', { encoding })
}

export async function pushAsrChunk(sessionId: string, audioBase64: string, isLast = false): Promise<ResponseData<{ partial: string; isFinal: boolean }>> {
  return request('/speech/asr/session/chunk', 'POST', { sessionId, audioBase64, isLast })
}

export async function endAsrSession(sessionId: string): Promise<ResponseData<{ text: string }>> {
  return request('/speech/asr/session/end', 'POST', { sessionId })
}

export async function assessSpeech(referenceText: string, audioBase64: string, mimeType = 'audio/mp3'): Promise<ResponseData<{ transcript: string; score: number; passed: boolean; feedback: string }>> {
  return request('/speech/assess', 'POST', { referenceText, audioBase64, mimeType })
}

export async function transcribeAudio(audioBase64: string, mimeType = 'audio/mp3'): Promise<ResponseData<{ text: string }>> {
  return request('/speech/transcribe', 'POST', { audioBase64, mimeType })
}

// ========== Membership API ==========
export async function getMembershipInfo(): Promise<ResponseData<{ isPremium: boolean; expireAt?: string; plans: Array<{ id: string; name: string; price: string; duration: string }>; currentPlan?: string }> | any> {
  return request('/membership/info', 'GET')
}

// ========== TTS API ==========
export async function playTts(text: string): Promise<void> {
  const baseUrl = getApiBaseUrl()
  await fetch(`${baseUrl}/tts/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}
