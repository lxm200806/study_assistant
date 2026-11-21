import path from 'path'
import { VOCABULARY_BOOK_CODES } from '../../src/data/vocabulary'

export const SERVER_ROOT = path.join(__dirname, '../..')
export const BOOKS_DIR = path.join(SERVER_ROOT, 'data/vocabulary/books')
export const TMP_DIR = path.join(SERVER_ROOT, 'tmp')

/** 导出/合并时可接受的成品书 code */
export const VOCABULARY_BOOK_CODES_HINT = VOCABULARY_BOOK_CODES.join(', ')

export function resolveBookCodes(argv: string[]): string[] {
  const args = argv.filter(a => !a.startsWith('--') && !a.endsWith('.ts') && !/[\\/]/.test(a))
  if (!args.length) return [...VOCABULARY_BOOK_CODES]
  for (const code of args) {
    if (!(VOCABULARY_BOOK_CODES as readonly string[]).includes(code)) {
      throw new Error(`未知词书: ${code}（可用: ${VOCABULARY_BOOK_CODES_HINT}）`)
    }
  }
  return args
}
