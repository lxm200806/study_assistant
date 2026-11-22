import { getPepBook } from '@/data/primary/load'

const LAST_BOOK_KEY = 'lastPrimaryBookCode'

export function rememberPrimaryBook(code: string) {
  const next = String(code || '').trim()
  if (!next || !getPepBook(next)) return
  uni.setStorageSync(LAST_BOOK_KEY, next)
}

export function lastPrimaryBookCode(): string {
  const raw = uni.getStorageSync(LAST_BOOK_KEY)
  const code = typeof raw === 'string' ? raw.trim() : ''
  if (!code || !getPepBook(code)) return ''
  return code
}
