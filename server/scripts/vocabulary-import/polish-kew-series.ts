#!/usr/bin/env ts-node
/**
 * 用简单易懂义项覆盖 kew4500 / kew7200 的汉语、音标、英语解释、例句。
 * 用法: node ./node_modules/ts-node/dist/bin.js --transpile-only scripts/vocabulary-import/polish-kew-series.ts
 */
import fs from 'fs'
import path from 'path'
import type { WordData, WordSources } from '../../src/data/vocabulary/types'
import {
  glossKey,
  validateGloss,
  type ElementaryGloss
} from './polish-kew-elementary'

const ROOT = path.join(__dirname, '../..')
const BOOKS_DIR = path.join(ROOT, 'data/vocabulary/books')
const GLOSS_DIR = path.join(ROOT, 'data/sources/kew/series')
const PDF_NOTE = 'kew-student-pdf-image-only'
const EDITOR = 'editor-series'

const SENSE_SOURCES: Record<string, string> = {
  'iron::metal': 'kew-unit-checked',
  'iron::appliance': 'kew-unit-checked',
  'major::n': 'kew-unit-checked',
  'major::adj': 'kew-unit-checked',
  'resolution::solution': 'kew-unit-checked',
  'resolution::decision': 'kew-unit-checked',
  'sense::feeling': 'kew-unit-checked',
  'sense::perception': 'kew-unit-checked'
}

const BOOK_CODES = [
  'kew4500-1',
  'kew4500-2',
  'kew4500-3',
  'kew4500-4',
  'kew7200-1',
  'kew7200-2',
  'kew7200-3'
]

type GlossMap = Record<string, ElementaryGloss>

function listSource(code: string): string {
  return code.startsWith('kew4500') ? 'kew4500-word-lists' : 'kew7200-toc'
}

function sourceTags(sources: WordSources): string[] {
  return [
    `src:list=${sources.list}`,
    `src:meaning=${sources.meaning}`,
    `src:phonetic=${sources.phonetic}`,
    `src:english=${sources.englishMeaning}`,
    `src:example=${sources.example}`
  ]
}

function loadGlossMap(code: string): GlossMap {
  const file = path.join(GLOSS_DIR, `${code}-glosses.json`)
  if (!fs.existsSync(file)) {
    throw new Error(`缺少义项表: ${file}`)
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as GlossMap
}

function polishBook(code: string) {
  const bookPath = path.join(BOOKS_DIR, `${code}.json`)
  const book = JSON.parse(fs.readFileSync(bookPath, 'utf-8')) as {
    code: string
    name: string
    words: WordData[]
    [key: string]: unknown
  }
  const glosses = loadGlossMap(code)
  const issues: string[] = []

  book.words = book.words.map(item => {
    const key = glossKey(item.word, item.senseKey)
    const gloss = glosses[key]
    if (!gloss) {
      issues.push(`缺义项 ${key}`)
      return item
    }
    const errors = validateGloss(item.word, gloss)
    if (errors.length) {
      issues.push(`${key}: ${errors.join('; ')}`)
    }
    const meaningSource = SENSE_SOURCES[key] || EDITOR
    const sources: WordSources = {
      list: listSource(code),
      meaning: meaningSource,
      phonetic: EDITOR,
      englishMeaning: code.startsWith('kew4500') ? 'kew4500-word-lists' : EDITOR,
      example: EDITOR
    }
    const tags = (item.tags || []).filter(tag => !tag.startsWith('src:') && tag !== PDF_NOTE)
    return {
      ...item,
      meaning: gloss.meaning,
      englishMeaning: gloss.englishMeaning,
      phonetic: gloss.phonetic,
      exampleSentence: gloss.exampleSentence,
      sources,
      tags: [...tags, PDF_NOTE, ...sourceTags(sources)]
    }
  })

  book.wordCount = book.words.length
  fs.writeFileSync(bookPath, `${JSON.stringify(book, null, 2)}\n`)
  return { count: book.words.length, issues }
}

function main() {
  fs.mkdirSync(GLOSS_DIR, { recursive: true })
  const report: Record<string, unknown> = {}
  for (const code of BOOK_CODES) {
    const result = polishBook(code)
    report[code] = result
    console.log(`${code}: ${result.count} 词, 问题 ${result.issues.length} 条`)
    for (const issue of result.issues.slice(0, 15)) console.log(`  ${issue}`)
    if (result.issues.length > 15) console.log(`  ... 另有 ${result.issues.length - 15} 条`)
  }
  fs.writeFileSync(path.join(GLOSS_DIR, 'polish-report.json'), `${JSON.stringify(report, null, 2)}\n`)
}

if (require.main === module) {
  main()
}
