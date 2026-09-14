#!/usr/bin/env ts-node
/**
 * 给已有成品词书补齐 KEW 同款字段：中文意思、音标、英文释义、例句。
 * 不重建词表。MSE 同时写出 gloss 文件，供以后 polish。
 */
import fs from 'fs'
import path from 'path'
import type { WordData } from '../../src/data/vocabulary/types'
import { completeWordData, writeGlossFile, applyGlosses } from './book-word'
import { BOOKS_DIR } from './kew-layout'
import {
  MSE_BOOKS,
  MSE_LIST_SOURCE,
  mseGlossPath,
  type MseBook
} from './mse-layout'

const LIST_SOURCE: Record<string, string> = {
  'mse-ket': MSE_LIST_SOURCE,
  'mse-pet': MSE_LIST_SOURCE,
  zhongkao: 'kylebing-junior',
  gaokao: 'kylebing-senior'
}

function isMseBook(code: string): code is MseBook {
  return (MSE_BOOKS as string[]).includes(code)
}

function main() {
  const files = fs.readdirSync(BOOKS_DIR).filter(file => file.endsWith('.json') && !file.startsWith('kew'))
  for (const file of files) {
    const code = file.replace(/\.json$/, '')
    const filePath = path.join(BOOKS_DIR, file)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const pretty = /\n\s{2}"/.test(raw)
    const book = JSON.parse(raw) as { words: WordData[]; [key: string]: unknown }
    const listSource = LIST_SOURCE[code] || 'list'
    book.words = book.words.map(item => completeWordData(item, listSource))
    if (isMseBook(code)) {
      const glossPath = mseGlossPath(code)
      writeGlossFile(glossPath, book.words)
      const glosses = JSON.parse(fs.readFileSync(glossPath, 'utf-8'))
      book.words = applyGlosses(book.words, glosses, MSE_LIST_SOURCE)
      console.log(`${code}: ${book.words.length} 词, gloss → ${glossPath}`)
    } else {
      console.log(`${code}: ${book.words.length} 词`)
    }
    book.wordCount = book.words.length
    fs.writeFileSync(filePath, pretty ? `${JSON.stringify(book, null, 2)}\n` : JSON.stringify(book))
  }
}

main()
