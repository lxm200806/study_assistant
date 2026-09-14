#!/usr/bin/env ts-node
/**
 * 从各书 JSON 生成全局义项表 senses.json。
 * 一词一行：先出现的合格释义保留；例句仍留在各书里。
 * 优先级：KEW 1200 → 4500 → 7200 → MSE → 中考 → 高考。
 */
import fs from 'fs'
import path from 'path'
import { vocabularyBooks } from '../../src/data/vocabulary'
import { sensesFilePath, type GlobalSense } from '../../src/data/vocabulary/senses'

const PRIORITY = [
  'kew1200-1',
  'kew1200-2',
  'kew1200-3',
  'kew4500-1',
  'kew4500-2',
  'kew4500-3',
  'kew4500-4',
  'kew7200-1',
  'kew7200-2',
  'kew7200-3',
  'mse-ket',
  'mse-pet',
  'zhongkao',
  'gaokao'
]

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}

function isFakePhonetic(word: string, phonetic: string): boolean {
  const inner = phonetic.replace(/^\/|\/$/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  return inner === word.toLowerCase()
}

function isGoodMeaning(text: string): boolean {
  return !!text && hasChinese(text) && !text.includes('[待校对]')
}

function isGoodEnglish(text: string): boolean {
  return !!text && !hasChinese(text) && !text.includes('[待校对]') && !text.startsWith('a listed') && !text.startsWith('a useful English word')
}

async function main() {
  const byCode = new Map(vocabularyBooks.map(book => [book.code, book]))
  const out: Record<string, GlobalSense> = {}

  for (const code of PRIORITY) {
    const book = byCode.get(code)
    if (!book) continue
    for (const item of book.words) {
      const word = item.word.trim().toLowerCase()
      if (!word) continue
      const current = out[word]
      if (!current) {
        if (!isGoodMeaning(item.meaning)) continue
        out[word] = {
          meaning: item.meaning,
          englishMeaning: isGoodEnglish(item.englishMeaning) ? item.englishMeaning : '',
          phonetic: item.phonetic && !isFakePhonetic(word, item.phonetic) ? item.phonetic : ''
        }
        continue
      }
      if (!current.englishMeaning && isGoodEnglish(item.englishMeaning)) {
        current.englishMeaning = item.englishMeaning
      }
      if (!current.phonetic && item.phonetic && !isFakePhonetic(word, item.phonetic)) {
        current.phonetic = item.phonetic
      }
    }
  }

  const file = sensesFilePath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const keys = Object.keys(out).sort()
  const sorted: Record<string, GlobalSense> = {}
  for (const key of keys) sorted[key] = out[key]
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`senses.json: ${keys.length} 词 → ${file}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
