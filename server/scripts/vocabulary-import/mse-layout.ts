import path from 'path'

export type MseBook = 'mse-ket' | 'mse-pet'

export const MSE_BOOKS: MseBook[] = ['mse-ket', 'mse-pet']

export const SERVER_ROOT = path.join(__dirname, '../..')
export const MSE_ROOT = path.join(SERVER_ROOT, 'data/sources/mse')
export const BOOKS_DIR = path.join(SERVER_ROOT, 'data/vocabulary/books')
export const TMP_DIR = path.join(SERVER_ROOT, 'tmp', 'mse')

export const MSE_META: Record<MseBook, {
  code: MseBook
  name: string
  description: string
  level: string
  source: string
}> = {
  'mse-ket': {
    code: 'mse-ket',
    name: 'MSE KET',
    description: '剑桥通用英语 A2 Key 官方词表（2025年8月）。只收词目/主题词，不含例句跑动词。',
    level: 'A2',
    source: 'cambridge-a2-key-2025-08'
  },
  'mse-pet': {
    code: 'mse-pet',
    name: 'MSE PET',
    description: '剑桥通用英语 B1 Preliminary 官方词表（2025年8月）。只收词目/主题词，不含例句跑动词。',
    level: 'B1',
    source: 'cambridge-b1-preliminary-2025-08'
  }
}

export function mseSourcePath(code: MseBook): string {
  return path.join(MSE_ROOT, `${code}.txt`)
}

export const MSE_LIST_SOURCE = 'cambridge-mse'
export const MSE_EDITOR = 'editor-mse'

export function mseWordListPath(code: MseBook): string {
  return path.join(MSE_ROOT, `${code}-words.json`)
}

export function mseGlossPath(code: MseBook): string {
  return path.join(MSE_ROOT, `${code}-glosses.json`)
}

export function mseBookPath(code: MseBook): string {
  return path.join(BOOKS_DIR, `${code}.json`)
}
