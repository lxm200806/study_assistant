#!/usr/bin/env ts-node
/**
 * 用本地全局词典（senses.json）回填成品词书的 topic / cefr / exam 句等。
 * 日常不再读取词光仓库；词光请先：npm run cidian:daoru-ciguang
 *
 * 用法（在 server/ 下）：
 *   npm run cidian:tianchong
 *   npm run cidian:tianchong -- --dry-run
 *   npm run cidian:tianchong -- kew1200.json
 */
import fs from 'fs'
import path from 'path'
import type { CefrLevel, WordData, WordExample } from '../../src/data/vocabulary/types'
import { isWeakTopic, normalizeTopic } from '../../src/data/taxonomy'
import {
  asFlatSense,
  buildSenseFromFlat,
  lookupSense,
  normalizeSenseEntry,
  type FlatSenseView,
  type GlobalSense
} from '../../src/data/vocabulary/senses'
import { BOOKS_DIR } from './kew-layout'

const LEXICON_TAG = 'src:lexicon=senses.json'

export interface EnrichStats {
  words: number
  basicEnsured: number
  examAdded: number
  topicFilled: number
  cefrFilled: number
  atlasHits: number
}

function hasRole(examples: WordExample[] | undefined, role: WordExample['role']): boolean {
  return (examples || []).some(e => e.role === role && !!e.en?.trim())
}

function pushUniqueExample(list: WordExample[], next: WordExample): boolean {
  const en = next.en.trim()
  if (!en) return false
  if (list.some(e => e.en.trim().toLowerCase() === en.toLowerCase())) return false
  list.push({ ...next, en })
  return true
}

export function syncLegacyExampleFields(word: WordData) {
  const examples = word.examples || []
  const ordered = [
    ...examples.filter(e => e.role === 'basic'),
    ...examples.filter(e => e.role === 'exam'),
    ...examples.filter(e => e.role === 'sense')
  ]
  const ens = ordered.map(e => e.en.trim()).filter(Boolean)
  if (ens[0]) word.exampleSentence = ens[0]
  word.exampleSentences = ens
  word.topic = normalizeTopic(word.topic || word.topics?.[0])
  word.topics = word.topics?.length
    ? [...new Set(word.topics.map(normalizeTopic))]
    : [word.topic]
}

/** 保证有 basic；不改已有 basic 正文（保护 KEW）。 */
export function ensureBasicExample(word: WordData): boolean {
  const examples = [...(word.examples || [])]
  if (hasRole(examples, 'basic')) {
    word.examples = examples
    syncLegacyExampleFields(word)
    return false
  }

  const candidate =
    word.exampleSentence?.trim() ||
    (word.exampleSentences || []).map(s => s.trim()).find(Boolean) ||
    ''

  let added = false
  if (candidate) {
    added = pushUniqueExample(examples, {
      en: candidate,
      role: 'basic',
      source: word.sources?.example || 'legacy'
    })
  }

  word.examples = examples
  syncLegacyExampleFields(word)
  return added
}

function ensureTopicShape(word: WordData) {
  word.topic = normalizeTopic(word.topic || word.topics?.[0])
  word.topics = word.topics?.length
    ? [...new Set(word.topics.map(normalizeTopic))]
    : [word.topic]
}

function resolveFlatLexicon(
  lexiconEntry?:
    | GlobalSense
    | FlatSenseView
    | { topic?: string; cefr?: string; ex?: Array<{ en?: string; zh?: string }> }
    | undefined
): FlatSenseView | undefined {
  if (!lexiconEntry) return undefined
  const raw = lexiconEntry as Record<string, unknown>
  // 旧测试：假 atlas 对象带 ex[]
  if (Array.isArray(raw.ex) && !Array.isArray(raw.meanings) && typeof raw.meaning !== 'string') {
    const ex = raw.ex as Array<{ en?: string; zh?: string }>
    return asFlatSense(
      buildSenseFromFlat({
        topic: typeof raw.topic === 'string' ? raw.topic : undefined,
        cefr: typeof raw.cefr === 'string' ? raw.cefr : undefined,
        examExample: ex[1]?.en || ex[0]?.en,
        examExampleZh: ex[1]?.zh || ex[0]?.zh,
        status: 'pending',
        origin: 'lexicon'
      })
    )
  }
  return asFlatSense(normalizeSenseEntry(lexiconEntry))
}

/** @deprecated 名称保留兼容测试；实际从全局词典取数 */
export function enrichWordFromAtlas(
  word: WordData,
  lexiconEntry?:
    | GlobalSense
    | FlatSenseView
    | { topic?: string; cefr?: string; ex?: Array<{ en?: string; zh?: string }> }
    | undefined
): {
  basicEnsured: boolean
  examAdded: boolean
  topicFilled: boolean
  cefrFilled: boolean
  hit: boolean
} {
  const basicEnsured = ensureBasicExample(word)
  ensureTopicShape(word)

  // 显式传入（测试/覆盖）优先于全局词典
  const fromArg = resolveFlatLexicon(lexiconEntry)
  const fromFile = lookupSense(word.word)
  const entry = fromArg || (fromFile ? asFlatSense(fromFile) : undefined)
  if (!entry) {
    syncLegacyExampleFields(word)
    return {
      basicEnsured,
      examAdded: false,
      topicFilled: false,
      cefrFilled: false,
      hit: false
    }
  }

  const examples = [...(word.examples || [])]
  let examAdded = false
  if (!hasRole(examples, 'exam') && entry.examExample?.trim()) {
    examAdded = pushUniqueExample(examples, {
      en: entry.examExample.trim(),
      zh: entry.examExampleZh?.trim() || undefined,
      role: 'exam',
      source: entry.origin || 'lexicon'
    })
  }
  word.examples = examples

  let topicFilled = false
  const lexiconTopic = normalizeTopic(entry.topic || '')
  if (
    entry.topic &&
    !isWeakTopic(lexiconTopic) &&
    isWeakTopic(word.topic) &&
    normalizeTopic(word.topic) !== lexiconTopic
  ) {
    word.topic = lexiconTopic
    word.topics = [lexiconTopic]
    topicFilled = true
  }

  let cefrFilled = false
  const cefr = String(entry.cefr || '').toUpperCase() as CefrLevel
  if (!word.cefr && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(cefr)) {
    word.cefr = cefr
    cefrFilled = true
  }

  if (examAdded || topicFilled || cefrFilled) {
    word.tags = [...new Set([...(word.tags || []), LEXICON_TAG])]
    const baseSources = word.sources || {
      list: 'unknown',
      meaning: 'unknown',
      phonetic: 'unknown',
      englishMeaning: 'unknown',
      example: 'unknown'
    }
    word.sources = {
      ...baseSources,
      examExample: examAdded ? entry.origin || 'lexicon' : baseSources.examExample,
      topic: topicFilled ? entry.origin || 'lexicon' : baseSources.topic,
      cefr: cefrFilled ? entry.origin || 'lexicon' : baseSources.cefr
    }
  }

  syncLegacyExampleFields(word)
  return { basicEnsured, examAdded, topicFilled, cefrFilled, hit: true }
}

export function enrichBookWords(words: WordData[]): EnrichStats {
  const stats: EnrichStats = {
    words: words.length,
    basicEnsured: 0,
    examAdded: 0,
    topicFilled: 0,
    cefrFilled: 0,
    atlasHits: 0
  }

  for (const word of words) {
    const result = enrichWordFromAtlas(word, lookupSense(word.word))
    if (result.basicEnsured) stats.basicEnsured += 1
    if (result.hit) stats.atlasHits += 1
    if (result.examAdded) stats.examAdded += 1
    if (result.topicFilled) stats.topicFilled += 1
    if (result.cefrFilled) stats.cefrFilled += 1
  }

  return stats
}

function main() {
  const args = process.argv.slice(2).filter(a => a !== '--')
  const dryRun = args.includes('--dry-run')
  const only = args.filter(a => !a.startsWith('--'))

  console.log('数据源: 本地全局词典 senses.json（不再读词光）')
  if (dryRun) console.log('dry-run：不写文件')

  const files = fs
    .readdirSync(BOOKS_DIR)
    .filter(f => f.endsWith('.json'))
    .filter(f =>
      only.length
        ? only.some(o => f === o || f === `${o}.json` || f.replace(/\.json$/, '') === o)
        : true
    )
    .sort()

  if (!files.length) {
    console.error('没有匹配的成品词书')
    process.exit(1)
  }

  const total: EnrichStats = {
    words: 0,
    basicEnsured: 0,
    examAdded: 0,
    topicFilled: 0,
    cefrFilled: 0,
    atlasHits: 0
  }

  for (const file of files) {
    const filePath = path.join(BOOKS_DIR, file)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const pretty = /\n\s{2}"/.test(raw)
    const book = JSON.parse(raw) as { words: WordData[]; [key: string]: unknown }
    const stats = enrichBookWords(book.words)
    for (const k of Object.keys(total) as (keyof EnrichStats)[]) {
      total[k] += stats[k]
    }
    console.log(
      `${file}: words=${stats.words} lexicon=${stats.atlasHits} basic+${stats.basicEnsured} exam+${stats.examAdded} topic+${stats.topicFilled} cefr+${stats.cefrFilled}`
    )
    if (!dryRun) {
      book.wordCount = book.words.length
      const body = pretty ? `${JSON.stringify(book, null, 2)}\n` : `${JSON.stringify(book)}\n`
      fs.writeFileSync(filePath, body)
    }
  }

  console.log(
    `\n合计: words=${total.words} lexicon=${total.atlasHits} basic+${total.basicEnsured} exam+${total.examAdded} topic+${total.topicFilled} cefr+${total.cefrFilled}`
  )
  console.log('缺词请先: npm run cidian:quezi -- <书号> --write ，再 cidian:jiaoyan，然后 paoguang / cidian:tianchong。')
}

if (require.main === module) {
  main()
}
