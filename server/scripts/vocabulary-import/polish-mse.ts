#!/usr/bin/env ts-node
/**
 * 用 gloss 覆盖 MSE 词书的汉语、音标、英语解释、例句。
 * 用法: npx ts-node --transpile-only scripts/vocabulary-import/polish-mse.ts [mse-ket|mse-pet]
 */
import fs from 'fs'
import type { WordData } from '../../src/data/vocabulary/types'
import { applyGlosses } from './book-word'
import { glossKey } from './kew-gloss'
import {
  MSE_BOOKS,
  MSE_EDITOR,
  MSE_LIST_SOURCE,
  MSE_META,
  TMP_DIR,
  mseBookPath,
  mseGlossPath,
  type MseBook
} from './mse-layout'

function resolveBooks(argv: string[]): MseBook[] {
  const args = argv.filter(arg => !arg.startsWith('--') && !arg.endsWith('.ts') && !/[\\/]/.test(arg))
  if (!args.length) return [...MSE_BOOKS]
  return args.map(arg => {
    const code = arg.toLowerCase().replace(/_/g, '-') as MseBook
    if (!MSE_BOOKS.includes(code)) throw new Error(`未知书号: ${arg}`)
    return code
  })
}

function polishBook(code: MseBook) {
  const bookPath = mseBookPath(code)
  const glossPath = mseGlossPath(code)
  if (!fs.existsSync(bookPath)) throw new Error(`缺少成品词书: ${bookPath}`)
  if (!fs.existsSync(glossPath)) throw new Error(`缺少义项表: ${glossPath}`)

  const book = JSON.parse(fs.readFileSync(bookPath, 'utf-8')) as {
    words: WordData[]
    [key: string]: unknown
  }
  const glosses = JSON.parse(fs.readFileSync(glossPath, 'utf-8')) as Record<string, {
    meaning: string
    englishMeaning: string
    phonetic: string
    exampleSentence: string
  }>

  const missing = book.words
    .map(item => glossKey(item.word))
    .filter(key => !glosses[key])

  book.words = applyGlosses(book.words, glosses, MSE_LIST_SOURCE, MSE_EDITOR)
  book.wordCount = book.words.length
  fs.writeFileSync(bookPath, `${JSON.stringify(book, null, 2)}\n`)
  return { count: book.words.length, missingGloss: missing.length, missing }
}

function main() {
  fs.mkdirSync(TMP_DIR, { recursive: true })
  const report: Record<string, unknown> = {}
  for (const code of resolveBooks(process.argv.slice(2))) {
    const result = polishBook(code)
    report[code] = { count: result.count, missingGloss: result.missingGloss, sample: result.missing.slice(0, 20) }
    console.log(`${MSE_META[code].name}: ${result.count} 词, 缺 gloss ${result.missingGloss} 条`)
    for (const key of result.missing.slice(0, 20)) console.log(`  缺义项 ${key}`)
    if (result.missing.length > 20) console.log(`  ... 另有 ${result.missing.length - 20} 条`)
  }
  fs.writeFileSync(`${TMP_DIR}/polish-report.json`, `${JSON.stringify(report, null, 2)}\n`)
}

if (require.main === module) {
  main()
}
