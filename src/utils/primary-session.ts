import catalog from '@/data/primary/catalog.json'

const LAST_BOOK_KEY = 'lastPrimaryBookCode'
const LAST_UNIT_PREFIX = 'lastPrimaryUnit:'
const BOOK_CODES = new Set(
  (catalog.books as Array<{ code: string }>).map(book => book.code)
)

export function rememberPrimaryBook(code: string) {
  const next = String(code || '').trim()
  if (!next || !BOOK_CODES.has(next)) return
  uni.setStorageSync(LAST_BOOK_KEY, next)
}

export function lastPrimaryBookCode(): string {
  const raw = uni.getStorageSync(LAST_BOOK_KEY)
  const code = typeof raw === 'string' ? raw.trim() : ''
  if (!code || !BOOK_CODES.has(code)) return ''
  return code
}

export function rememberPrimaryUnit(code: string, unitId: string) {
  const nextCode = String(code || '').trim()
  const nextUnit = String(unitId || '').trim()
  if (!nextCode || !nextUnit || !BOOK_CODES.has(nextCode)) return
  uni.setStorageSync(`${LAST_UNIT_PREFIX}${nextCode}`, nextUnit)
}

export function lastPrimaryUnitId(code: string): string {
  const nextCode = String(code || '').trim()
  if (!nextCode || !BOOK_CODES.has(nextCode)) return ''
  const raw = uni.getStorageSync(`${LAST_UNIT_PREFIX}${nextCode}`)
  return typeof raw === 'string' ? raw.trim() : ''
}
