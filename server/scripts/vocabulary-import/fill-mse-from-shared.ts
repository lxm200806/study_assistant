#!/usr/bin/env ts-node
/**
 * 用其它已校验词书回填 MSE KET/PET 的缺失字段（不覆盖已有好释义）。
 * 优先：KEW / 中考 / 高考 / 已有成品；音标/英文命中率高，待校中文可补一部分。
 *
 *   npm run fill:mse
 */
import fs from 'fs'
import path from 'path'
import type { WordData, WordSources } from '../../src/data/vocabulary/types'
import { BOOKS_DIR } from './kew-layout'
import { mseBookPath, mseGlossPath, MSE_BOOKS, MSE_LIST_SOURCE, type MseBook } from './mse-layout'
import { glossKey, writeNormalizedGlosses } from './kew-gloss'
import { inferFieldSource, sourceTags, wordToGloss } from './book-word'
import { ensureBasicExample } from './enrich-from-atlas'

interface Donor {
  meaning?: string
  phonetic?: string
  englishMeaning?: string
  exampleSentence?: string
  source: string
}

function isFakePhonetic(word: string, phonetic: string): boolean {
  const inner = phonetic.replace(/^\/|\/$/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  return !inner || inner === word.toLowerCase()
}

function isPendingMeaning(text: string): boolean {
  return !text || text.startsWith('[待校对]')
}

function isPendingEnglish(text: string): boolean {
  return !text || text.startsWith('a listed') || text.includes('[待校对]')
}

function loadDonorPool(): Map<string, Donor> {
  const pool = new Map<string, Donor>()
  const files = fs.readdirSync(BOOKS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('mse-'))
  for (const file of files) {
    const book = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, file), 'utf-8')) as {
      code?: string
      words: WordData[]
    }
    const src = book.code || file.replace(/\.json$/, '')
    for (const w of book.words || []) {
      const key = glossKey(w.word)
      const cur = pool.get(key) || { source: src }
      if (!isPendingMeaning(w.meaning || '') && !cur.meaning) {
        cur.meaning = w.meaning
        cur.source = src
      }
      if (w.phonetic && !isFakePhonetic(w.word, w.phonetic) && !cur.phonetic) {
        cur.phonetic = w.phonetic
      }
      if (!isPendingEnglish(w.englishMeaning || '') && !cur.englishMeaning) {
        cur.englishMeaning = w.englishMeaning
      }
      if (w.exampleSentence && !cur.exampleSentence) {
        cur.exampleSentence = w.exampleSentence
      }
      pool.set(key, cur)
    }
  }
  return pool
}

function fillBook(code: MseBook, pool: Map<string, Donor>) {
  const bookPath = mseBookPath(code)
  const book = JSON.parse(fs.readFileSync(bookPath, 'utf-8')) as {
    words: WordData[]
    [key: string]: unknown
  }

  let meaningN = 0
  let phoneN = 0
  let englishN = 0
  let exampleN = 0

  book.words = book.words.map(item => {
    const key = glossKey(item.word)
    const donor = pool.get(key)
    if (!donor) {
      ensureBasicExample(item)
      return item
    }

    let meaning = item.meaning
    let phonetic = item.phonetic
    let englishMeaning = item.englishMeaning
    let exampleSentence = item.exampleSentence
    const sources: WordSources = {
      list: item.sources?.list || MSE_LIST_SOURCE,
      meaning: item.sources?.meaning || 'pending',
      phonetic: item.sources?.phonetic || 'pending',
      englishMeaning: item.sources?.englishMeaning || 'pending',
      example: item.sources?.example || 'generated',
      examExample: item.sources?.examExample,
      topic: item.sources?.topic,
      cefr: item.sources?.cefr
    }

    if (isPendingMeaning(meaning) && donor.meaning) {
      meaning = donor.meaning
      sources.meaning = `shared:${donor.source}`
      meaningN += 1
    }
    if ((isFakePhonetic(item.word, phonetic || '') || sources.phonetic === 'pending') && donor.phonetic) {
      phonetic = donor.phonetic
      sources.phonetic = `shared:${donor.source}`
      phoneN += 1
    }
    if (isPendingEnglish(englishMeaning || '') && donor.englishMeaning) {
      englishMeaning = donor.englishMeaning
      sources.englishMeaning = `shared:${donor.source}`
      englishN += 1
    }
    // 占位/生成句才替换；KEW 风格好句保留；basic 仍以现有为准
    const exampleIsWeak =
      !exampleSentence ||
      exampleSentence.startsWith('Students study the word') ||
      sources.example === 'generated'
    if (exampleIsWeak && donor.exampleSentence) {
      exampleSentence = donor.exampleSentence
      sources.example = `shared:${donor.source}`
      exampleN += 1
    }

    sources.meaning = inferFieldSource(item.word, 'meaning', meaning, sources.meaning)
    sources.phonetic = inferFieldSource(item.word, 'phonetic', phonetic || '', sources.phonetic)
    sources.englishMeaning = inferFieldSource(
      item.word,
      'englishMeaning',
      englishMeaning || '',
      sources.englishMeaning
    )
    sources.example = inferFieldSource(item.word, 'example', exampleSentence || '', sources.example)

    const tags = (item.tags || []).filter(t => !t.startsWith('src:'))
    const next: WordData = {
      ...item,
      meaning,
      phonetic,
      englishMeaning,
      exampleSentence,
      sources,
      tags: [...new Set([...tags, ...sourceTags(sources), ...(item.tags || []).filter(t => t.startsWith('src:atlas'))])]
    }

    // 同步 basic：若刚换成更好的简句，更新 examples.basic
    const basic = (next.examples || []).find(e => e.role === 'basic')
    if (basic && exampleSentence && basic.en !== exampleSentence && sources.example.startsWith('shared:')) {
      basic.en = exampleSentence
      basic.source = sources.example
    }
    ensureBasicExample(next)
    return next
  })

  book.wordCount = book.words.length
  fs.writeFileSync(bookPath, `${JSON.stringify(book, null, 2)}\n`)

  // 同步 gloss，供后续 polish:mse
  const glossPath = mseGlossPath(code)
  const glossMap: Record<string, ReturnType<typeof wordToGloss>> = {}
  for (const w of book.words) {
    glossMap[glossKey(w.word)] = wordToGloss(w)
  }
  writeNormalizedGlosses(glossPath, glossMap)

  console.log(
    `${code}: meaning+${meaningN} phonetic+${phoneN} english+${englishN} example+${exampleN} → ${bookPath}`
  )
}

function main() {
  const pool = loadDonorPool()
  console.log(`共享词库 donor: ${pool.size}`)
  for (const code of MSE_BOOKS) {
    fillBook(code, pool)
  }
}

if (require.main === module) {
  main()
}
