// API Client for Study Assistant Mobile (React Native compatible)
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

/* ═══ Core Types ═══ */
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
const DEFAULT_TIMEOUT_MS = 120000

/* ═══ Config ═══ */
export function getApiBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
    'http://127.0.0.1:3004/api'
  )
}

/* ═══ Auth Token Management ═══ */
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
  } catch { return null }
}

export async function refreshAndRetry(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  refreshPromise = refreshTokenInternal().finally(() => { refreshPromise = null })
  return refreshPromise
}

/* ═══ Request Engine ═══ */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetch(url, { ...options, signal: controller.signal }) }
  finally { clearTimeout(timeoutId) }
}

async function requestRaw(path: string, method: HttpMethod = 'GET', data?: unknown, maxRetries = 1): Promise<Response> {
  const token = await getAccessToken()
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(getApiBaseUrl() + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: data ? JSON.stringify(data) : undefined,
      })
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

export async function request<T>(path: string, method: HttpMethod = 'GET', data?: unknown): Promise<ResponseData<T>> {
  const response = await requestRaw(path, method, data)
  const body = await response.json().catch(() => ({})) as ResponseData<T>
  if (response.ok) return body
  const error = body.error || 'Request failed: ' + response.status
  if (response.status === 401) throw new Error('Unauthorized: ' + error)
  if (response.status === 403) throw new Error('BOOK_LOCKED: ' + error)
  throw new Error(error)
}

/* ═══ Auth API ═══ */
export interface AuthUser { id: string; username: string }
export function authLogin(username: string, password: string) { return request('/auth/login', 'POST', { username, password }) }
export function authRegister(username: string, password: string) { return request('/auth/register', 'POST', { username, password }) }
export function authProfile() { return request('/auth/profile') }
export function authOnboard() { return request('/auth/onboard', 'POST') }

/* ═══ Books API ═══ */
export interface Book { id: string; code: string; name: string; description: string; level: string; wordCount: number; isFree?: boolean }
export function listBooks() { return request('/books') }

/* ═══ Vocabulary API (mounted at /api/vocab/) ═══ */
export interface WordEntry { id: string; word: string; meaning: string; phonetic?: string; example?: string; image?: string }
export async function listVocabulary(page = 1, limit = 40) {
  const p = new URLSearchParams({ page: String(page), limit: String(limit) })
  return request('/?' + p.toString())
}
export function getVocabularyDetail(id: string) { return request('/' + id) }
export function getRandomVocabulary(count = 10) { return request('/random?count=' + count) }

/* ═══ Training API (mounted at /api/training/) ═══ */
export function submitPractice(wordId: string, type: string, isCorrect: boolean) {
  return request('/practice', 'POST', { wordId, type, isCorrect })
}
export async function getSessionReview(type?: string, bookCode?: string, limit = 5) {
  const p = new URLSearchParams()
  if (type) p.set('type', type)
  if (bookCode) p.set('bookCode', bookCode)
  p.set('limit', String(limit))
  return request('/review?' + p.toString())
}
export function completeSession(bookCode: string, wordIds: string[]) {
  return request('/session/complete', 'POST', { bookCode, wordIds })
}

/* ═══ Stats API (mounted at /api/stats/) ═══ */
export function loadDailyStats() { return request('/daily') }

/* ═══ Membership API (mounted at /api/membership/) ═══ */
export function getMembershipInfo() { return request('/membership/info') }

/* ═══ Quiz API (under /api/training/) ═══ */
export interface QuizWord { id: string; word: string; phonetic?: string; meaning?: string }
export async function getQuizWords(bookCode: string, count = 30) {
  const p = new URLSearchParams({ bookCode, count: String(count) })
  return request('/quiz/words?' + p.toString())
}
export function submitQuizAnswers(bookCode: string, items: Array<{ wordId: string; isCorrect: boolean }>) {
  return request('/quiz/submit', 'POST', { bookCode, items })
}

/* ═══ Vocabulary Map API (mounted at /api/vocab/maps/) ═══ */
import { type VocabularyMapData } from '@/types/map'
export function loadBookMap(bookCode: string) { return request('/maps/book/' + bookCode) as Promise<ResponseData<VocabularyMapData>> }
export function loadGlobalMap(limit = 500) { return request('/maps/global?limit=' + limit) as Promise<ResponseData<VocabularyMapData>> }
