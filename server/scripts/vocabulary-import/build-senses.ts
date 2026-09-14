#!/usr/bin/env ts-node
/**
 * 从各书 JSON 生成全局义项表 senses.json。
 * 一词一行：先出现的合格释义和例句保留。
 * 优先级：KEW 1200 → 4500 → 7200 → MSE → 中考 → 高考。
 */
import fs from 'fs'
import path from 'path'
import { vocabularyBooks } from '../../src/data/vocabulary'
import { collectBookWordEntries } from '../../src/data/vocabulary/book-entries'
import { sensesFilePath, senseWithExamples, type GlobalSense } from '../../src/data/vocabulary/senses'
import { exampleContainsWord } from './book-word'

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

function isGoodExample(word: string, text: string): boolean {
  const example = text.trim()
  if (!example || hasChinese(example) || example.includes('[待校对]')) return false
  if (/^the word\b/i.test(example)) return false
  if (example.startsWith('a listed') || /target word/i.test(example)) return false
  return exampleContainsWord(word, example)
}

async function main() {
  const byCode = new Map(vocabularyBooks.map(book => [book.code, book]))
  const out: Record<string, GlobalSense> = {}

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
          examples
        })
        continue
      }
      if (!current.englishMeaning && isGoodEnglish(entry.englishMeaning)) {
        current.englishMeaning = entry.englishMeaning
      }
      if (!current.phonetic && entry.phonetic && !isFakePhonetic(word, entry.phonetic)) {
        current.phonetic = entry.phonetic
      }
      if (!current.exampleSentence && examples.length) {
        const next = senseWithExamples({ ...current, examples })
        current.exampleSentence = next.exampleSentence
        if (next.exampleSentences) current.exampleSentences = next.exampleSentences
      }
    }
  }

  const file = sensesFilePath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const keys = Object.keys(out).sort()
  const sorted: Record<string, GlobalSense> = {}
  for (const key of keys) sorted[key] = out[key]
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`)
  const withExample = keys.filter(key => sorted[key].exampleSentence).length
  const withMany = keys.filter(key => (sorted[key].exampleSentences?.length || 0) > 1).length
  console.log(`senses.json: ${keys.length} 词，${withExample} 条有例句，${withMany} 条有多条例句 → ${file}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
