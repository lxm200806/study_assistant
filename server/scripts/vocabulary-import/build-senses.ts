#!/usr/bin/env ts-node
/**
 * 从各书 JSON 生成全局义项表 senses.json（嵌套 meanings[]）。
 * 一词一行：先出现的合格释义和例句保留。
 * 优先级：KEW 1200 → 4500 → 7200 → MSE → 中考 → 高考。
 */
import fs from 'fs'
import path from 'path'
import { vocabularyBooks } from '../../src/data/vocabulary'
import { collectBookWordEntries } from '../../src/data/vocabulary/book-entries'
import {
  asFlatSense,
  buildSenseFromFlat,
  normalizeSenseEntry,
  sensesFilePath,
  senseWithExamples,
  type GlobalSense
} from '../../src/data/vocabulary/senses'
import { exampleContainsWord } from './book-word'

const PRIORITY = [
  'kew1200',
  'kew4500',
  'kew7200',
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

function isGoodExample(word: string, text: string): boolean {
  const example = text.trim()
  if (!example || hasChinese(example) || example.includes('[待校对]')) return false
  if (/^the word\b/i.test(example)) return false
  if (example.startsWith('a listed') || /target word/i.test(example)) return false
  return exampleContainsWord(word, example)
}

async function main() {
  const byCode = new Map(vocabularyBooks.map(book => [book.code, book]))
  // 保留已有全局条目的 enrichment / status，避免 build:senses 冲掉审核状态
  const existingRaw = fs.existsSync(sensesFilePath())
    ? (JSON.parse(fs.readFileSync(sensesFilePath(), 'utf-8')) as Record<string, unknown>)
    : {}
  const out: Record<string, GlobalSense> = {}
  for (const [key, value] of Object.entries(existingRaw)) {
    out[key.trim().toLowerCase()] = normalizeSenseEntry(value)
  }

  for (const code of PRIORITY) {
    const book = byCode.get(code)
    if (!book) continue
    for (const entry of collectBookWordEntries(book.words)) {
      const word = entry.word
      if (!word) continue
      const examples = entry.examples.filter(item => isGoodExample(word, item))
      const current = out[word]
      if (!current) {
        if (!isGoodMeaning(entry.meaning)) continue
        out[word] = senseWithExamples({
          meaning: entry.meaning,
          englishMeaning: isGoodEnglish(entry.englishMeaning) ? entry.englishMeaning : '',
          phonetic: entry.phonetic && !isFakePhonetic(word, entry.phonetic) ? entry.phonetic : '',
          examples,
          status: 'pending',
          origin: `book:${code}`
        })
        continue
      }
      if (current.status === 'verified' || current.status === 'llm') continue
      const flat = asFlatSense(current)
      let changed = false
      let nextEnglish = flat.englishMeaning
      let nextPhonetic = flat.phonetic
      let nextExample = flat.exampleSentence
      let nextExam = flat.examExample
      if (!nextEnglish && isGoodEnglish(entry.englishMeaning)) {
        nextEnglish = entry.englishMeaning
        changed = true
      }
      if (!nextPhonetic && entry.phonetic && !isFakePhonetic(word, entry.phonetic)) {
        nextPhonetic = entry.phonetic
        changed = true
      }
      if (!nextExample && examples.length) {
        nextExample = examples[0]
        if (examples[1] && !nextExam) nextExam = examples[1]
        changed = true
      }
      if (!changed) continue
      out[word] = buildSenseFromFlat({
        ...flat,
        englishMeaning: nextEnglish,
        phonetic: nextPhonetic,
        exampleSentence: nextExample,
        examExample: nextExam,
        status: flat.status || 'pending',
        origin: flat.origin || `book:${code}`
      })
    }
  }

  const file = sensesFilePath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const keys = Object.keys(out).sort()
  const sorted: Record<string, GlobalSense> = {}
  for (const key of keys) sorted[key] = normalizeSenseEntry(out[key])
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`)
  const withExample = keys.filter(key => asFlatSense(sorted[key]).exampleSentence).length
  const withMany = keys.filter(key => (sorted[key].meanings[0]?.sentences.length || 0) > 1).length
  const verified = keys.filter(key => sorted[key].status === 'verified').length
  console.log(
    `senses.json: ${keys.length} 词，${withExample} 条有例句，${withMany} 条有多条例句，verified ${verified} → ${file}`
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
