#!/usr/bin/env ts-node
/**
 * 用小学生义项覆盖 kew1/2/3 的汉语、音标、英语解释、例句，并写入校验来源。
 * 用法: node ./node_modules/ts-node/dist/bin.js --transpile-only scripts/vocabulary-import/polish-kew-elementary.ts
 */
import fs from 'fs'
import path from 'path'
import type { WordData, WordSources } from '../../src/data/vocabulary/types'

const ROOT = path.join(__dirname, '../..')
const BOOKS_DIR = path.join(ROOT, 'data/vocabulary/books')
const GLOSS_DIR = path.join(ROOT, 'data/sources/kew/elementary')

export interface ElementaryGloss {
  meaning: string
  englishMeaning: string
  phonetic: string
  exampleSentence: string
}

type GlossMap = Record<string, ElementaryGloss>

const LIST_SOURCE = 'kew-toc'
const PDF_NOTE = 'kew-student-pdf-image-only'
const EDITOR = 'editor-elementary'

const SENSE_SOURCES: Record<string, string> = {
  'fly::v': 'kew-unit-checked',
  'fly::insect': 'kew-unit-checked',
  'tear::n': 'kew-unit-checked',
  'tear::v': 'kew-unit-checked',
  'watch::v': 'kew-unit-checked',
  'watch::n': 'kew-unit-checked'
}

export function glossKey(word: string, senseKey = ''): string {
  return `${word.toLowerCase()}::${senseKey || ''}`
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}

function isFakePhonetic(word: string, phonetic: string): boolean {
  const inner = phonetic.replace(/^\/|\/$/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  return inner === word.toLowerCase()
}

function looksLikeIpa(phonetic: string): boolean {
  if (!/^\/[^/\n]{1,40}\/$/.test(phonetic)) return false
  return /[ˈˌːɪæɑɒʌəɜɔʊθðʃʒŋ]/.test(phonetic)
}

function exampleContainsWord(word: string, example: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(example)
}

export function validateGloss(word: string, gloss: ElementaryGloss): string[] {
  const errors: string[] = []
  if (!hasChinese(gloss.meaning) || gloss.meaning.includes('[待校对]')) {
    errors.push('汉语解释无效')
  }
  if (gloss.meaning.length > 20) errors.push('汉语解释过长')
  if (hasChinese(gloss.englishMeaning) || gloss.englishMeaning.length < 8) {
    errors.push('英语解释无效')
  }
  if (isFakePhonetic(word, gloss.phonetic) || !looksLikeIpa(gloss.phonetic)) {
    errors.push(`音标无效: ${gloss.phonetic}`)
  }
  if (!exampleContainsWord(word, gloss.exampleSentence)) {
    errors.push('例句未包含目标词')
  }
  const words = gloss.exampleSentence.trim().split(/\s+/)
  if (words.length < 4 || words.length > 16) errors.push('例句长度不合适')
  return errors
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
      list: LIST_SOURCE,
      meaning: meaningSource,
      phonetic: EDITOR,
      englishMeaning: EDITOR,
      example: EDITOR
    }
    const tags = (item.tags || []).filter(tag => !tag.startsWith('src:'))
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
  const report: Record<string, unknown> = {}
  for (const code of ['kew1', 'kew2', 'kew3']) {
    const result = polishBook(code)
    report[code] = result
    console.log(`${code}: ${result.count} 词, 问题 ${result.issues.length} 条`)
    for (const issue of result.issues.slice(0, 20)) console.log(`  ${issue}`)
    if (result.issues.length > 20) console.log(`  ... 另有 ${result.issues.length - 20} 条`)
  }
  fs.writeFileSync(path.join(GLOSS_DIR, 'polish-report.json'), JSON.stringify(report, null, 2))
}

if (require.main === module) {
  main()
}
