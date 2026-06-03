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
import { ketBook as ketFallback } from './ket'
import { petBook as petFallback } from './pet'
import { zhongkaoBook as zhongkaoFallback } from './zhongkao'
import { gaokaoBook as gaokaoFallback } from './gaokao'

const fallbacks: Record<string, BookData> = {
  ket: ketFallback,
  pet: petFallback,
  zhongkao: zhongkaoFallback,
  gaokao: gaokaoFallback
}

function loadBook(code: string): BookData {
  return loadBookJson(code) || fallbacks[code]
}

export type { WordData, BookData } from './types'

export const ketBook: BookData = loadBook('ket')
export const petBook: BookData = loadBook('pet')
export const zhongkaoBook: BookData = loadBook('zhongkao')
export const gaokaoBook: BookData = loadBook('gaokao')

/** 词汇书注册表 — 新增词书只需在此追加 */
export const vocabularyBooks: BookData[] = [
  ketBook,
  petBook,
  zhongkaoBook,
  gaokaoBook
]

export const getBookByCode = (code: string): BookData | undefined =>
  vocabularyBooks.find(book => book.code === code)

export const getAllWords = (): Array<WordData & { bookCode: string }> =>
  vocabularyBooks.flatMap(book =>
    book.words.map(word => ({ ...word, bookCode: book.code }))
  )
