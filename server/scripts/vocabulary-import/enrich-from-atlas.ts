#!/usr/bin/env ts-node
/**
 * 一期 enrichment：
 * 1) 把现有 exampleSentence 映射为 examples[].role=basic（不覆盖已有 basic / KEW 简句）
 * 2) 词光命中词：追加 exam 句、回填 topic/topics/cefr
 *
 * 词光数据 CC BY 4.0，署名 Word Atlas contributors。
 *
 * 用法（在 server/ 下）：
 *   npm run enrich:atlas
 *   npm run enrich:atlas -- --dry-run
 *   npm run enrich:atlas -- kew1200-1.json
 */
import fs from 'fs'
import path from 'path'
import type { CefrLevel, WordData, WordExample } from '../../src/data/vocabulary/types'
import { isWeakTopic, normalizeTopic } from '../../src/data/taxonomy'
import { BOOKS_DIR } from './kew-layout'

const ATLAS_DEFAULT = path.resolve(__dirname, '../../../../word-atlas/data/word-atlas.json')
const ATLAS_ATTR = 'Word Atlas contributors — CC BY 4.0'
const ATLAS_TAG = 'src:atlas=CC-BY-4.0'

interface AtlasExample {
  en?: string
  zh?: string
}

interface AtlasEntry {
  w: string
  topic?: string
  cefr?: string
  ex?: AtlasExample[]
}

export interface EnrichStats {
  words: number
  basicEnsured: number
  examAdded: number
  topicFilled: number
  cefrFilled: number
  atlasHits: number
}

function norm(word: string): string {
  return word.trim().toLowerCase().replace(/[’‘]/g, "'")
}

export function loadAtlasIndex(atlasPath: string): Map<string, AtlasEntry> {
  const raw = JSON.parse(fs.readFileSync(atlasPath, 'utf-8')) as AtlasEntry[]
  const map = new Map<string, AtlasEntry>()
  for (const entry of raw) {
    const key = norm(entry.w || '')
    if (key) map.set(key, entry)
  }
  return map
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

function pickAtlasExam(entry: AtlasEntry, basicEn: string): AtlasExample | null {
  const list = (entry.ex || []).filter(e => e.en?.trim())
  if (!list.length) return null
  const preferred = list[1] || list[0]
  if (!preferred?.en) return null
  if (preferred.en.trim().toLowerCase() === basicEn.trim().toLowerCase()) {
    return (
      list.find(e => e.en && e.en.trim().toLowerCase() !== basicEn.trim().toLowerCase()) || null
    )
  }
  return preferred
}

function ensureTopicShape(word: WordData) {
  word.topic = normalizeTopic(word.topic || word.topics?.[0])
  word.topics = word.topics?.length
    ? [...new Set(word.topics.map(normalizeTopic))]
    : [word.topic]
}

export function enrichWordFromAtlas(
  word: WordData,
  atlas: AtlasEntry | undefined
): {
  basicEnsured: boolean
  examAdded: boolean
  topicFilled: boolean
  cefrFilled: boolean
  hit: boolean
} {
  const basicEnsured = ensureBasicExample(word)
  ensureTopicShape(word)

  if (!atlas) {
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
  const basicEn = examples.find(e => e.role === 'basic')?.en || word.exampleSentence || ''

  let examAdded = false
  if (!hasRole(examples, 'exam')) {
    const exam = pickAtlasExam(atlas, basicEn)
    if (exam?.en) {
      examAdded = pushUniqueExample(examples, {
        en: exam.en,
        zh: exam.zh?.trim() || undefined,
        role: 'exam',
        source: 'word-atlas'
      })
    }
  }
  word.examples = examples

  let topicFilled = false
  const atlasTopic = normalizeTopic(atlas.topic)
  // 仅当现主题弱、词光主题更强时回填；已是同一主题则不动（保证幂等）
  if (
    !isWeakTopic(atlasTopic) &&
    isWeakTopic(word.topic) &&
    normalizeTopic(word.topic) !== atlasTopic
  ) {
    word.topic = atlasTopic
    word.topics = [atlasTopic]
    topicFilled = true
  }

  let cefrFilled = false
  const cefr = (atlas.cefr || '').toUpperCase() as CefrLevel
  if (!word.cefr && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(cefr)) {
    word.cefr = cefr
    cefrFilled = true
  }

  if (examAdded || topicFilled || cefrFilled) {
    word.tags = [...new Set([...(word.tags || []), ATLAS_TAG])]
    const baseSources = word.sources || {
      list: 'unknown',
      meaning: 'unknown',
      phonetic: 'unknown',
      englishMeaning: 'unknown',
      example: 'unknown'
    }
    word.sources = {
      ...baseSources,
      examExample: examAdded ? 'word-atlas' : baseSources.examExample,
      topic: topicFilled ? 'word-atlas' : baseSources.topic,
      cefr: cefrFilled ? 'word-atlas' : baseSources.cefr
    }
  }

  syncLegacyExampleFields(word)
  return { basicEnsured, examAdded, topicFilled, cefrFilled, hit: true }
}

export function enrichBookWords(
  words: WordData[],
  atlasIndex: Map<string, AtlasEntry>
): EnrichStats {
  const stats: EnrichStats = {
    words: words.length,
    basicEnsured: 0,
    examAdded: 0,
    topicFilled: 0,
    cefrFilled: 0,
    atlasHits: 0
  }

  for (const word of words) {
    const atlas = atlasIndex.get(norm(word.word))
    const result = enrichWordFromAtlas(word, atlas)
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
  const atlasPath = process.env.WORD_ATLAS_PATH || ATLAS_DEFAULT

  if (!fs.existsSync(atlasPath)) {
    console.error(`词光数据不存在: ${atlasPath}`)
    console.error('请设置 WORD_ATLAS_PATH，或把 word-atlas 放在与 study_assistant 同级目录。')
    process.exit(1)
  }

  console.log(`词光: ${atlasPath}`)
  console.log(`署名: ${ATLAS_ATTR}`)
  if (dryRun) console.log('dry-run：不写文件')

  const atlasIndex = loadAtlasIndex(atlasPath)
  console.log(`词光词条: ${atlasIndex.size}`)

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
    const stats = enrichBookWords(book.words, atlasIndex)
    for (const k of Object.keys(total) as (keyof EnrichStats)[]) {
      total[k] += stats[k]
    }
    console.log(
      `${file}: words=${stats.words} atlas=${stats.atlasHits} basic+${stats.basicEnsured} exam+${stats.examAdded} topic+${stats.topicFilled} cefr+${stats.cefrFilled}`
    )
    if (!dryRun) {
      book.wordCount = book.words.length
      const body = pretty ? `${JSON.stringify(book, null, 2)}\n` : `${JSON.stringify(book)}\n`
      fs.writeFileSync(filePath, body)
    }
  }

  console.log(
    `\n合计: words=${total.words} atlas=${total.atlasHits} basic+${total.basicEnsured} exam+${total.examAdded} topic+${total.topicFilled} cefr+${total.cefrFilled}`
  )
  console.log('完成后请重启后端以同步数据库（./restart-server.sh）。')
}

if (require.main === module) {
  main()
}
