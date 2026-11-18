import fs from 'fs'
import path from 'path'
import type { BookData, WordData } from './types'

// JSON 词库在 server/data/vocabulary/books（构建脚本输出）
const BOOKS_DIR = path.join(__dirname, '../../../data/vocabulary/books')

function loadBookJson(code: string): BookData | null {
  const file = path.join(BOOKS_DIR, `${code}.json`)
  if (!fs.existsSync(file)) return null

  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as BookData & { words: WordData[] }
  return {
    code: raw.code,
    name: raw.name,
    description: raw.description,
    level: raw.level,
    targetWordCount: raw.targetWordCount,
    words: raw.words
  }
}

// 回退：内置 TS 词库（无 JSON 时使用）
import { zhongkaoBook as zhongkaoFallback } from './zhongkao'
import { gaokaoBook as gaokaoFallback } from './gaokao'

const fallbacks: Record<string, BookData> = {
  zhongkao: zhongkaoFallback,
  gaokao: gaokaoFallback
}

/** 注册顺序：MSE → 中高考 → 四六级 → KEW */
export const VOCABULARY_BOOK_CODES = [
  'mse-ket',
  'mse-pet',
  'zhongkao',
  'gaokao',
  'cet4',
  'cet6',
  'kew1200',
  'kew4500',
  'kew7200'
] as const

const bookCache = new Map<string, BookData>()

export function loadBook(code: string): BookData | undefined {
  if (bookCache.has(code)) return bookCache.get(code)
  const book = loadBookJson(code) || fallbacks[code]
  if (book) bookCache.set(code, book)
  return book
}

/** 按需加载，避免启动时一次性把全部成品 JSON 塞进内存 */
export function getVocabularyBooks(): BookData[] {
  return VOCABULARY_BOOK_CODES.map(code => loadBook(code)).filter((b): b is BookData => !!b)
}

/** @deprecated 兼容旧引用；请优先用 getVocabularyBooks() / loadBook() */
export const vocabularyBooks: BookData[] = new Proxy([] as BookData[], {
  get(_target, prop, receiver) {
    const books = getVocabularyBooks()
    if (prop === 'length') return books.length
    if (prop === Symbol.iterator) return books[Symbol.iterator].bind(books)
    if (typeof prop === 'string' && /^\d+$/.test(prop)) return books[Number(prop)]
    const value = Reflect.get(books, prop, receiver)
    return typeof value === 'function' ? value.bind(books) : value
  }
})

export type { WordData, BookData } from './types'

export const zhongkaoBook: BookData = loadBook('zhongkao')!
export const gaokaoBook: BookData = loadBook('gaokao')!

export const getBookByCode = (code: string): BookData | undefined => loadBook(code)

export const getAllWords = (): Array<WordData & { bookCode: string }> =>
  getVocabularyBooks().flatMap(book =>
    book.words.map(word => ({ ...word, bookCode: book.code }))
  )
