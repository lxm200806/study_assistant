#!/usr/bin/env ts-node
/**
 * 一次性：把词光有用字段导入本地全局词典 senses.json（新嵌套结构）。
 * 用法: npm run cidian:daoru-ciguang
 */
import fs from 'fs'
import path from 'path'
import {
  buildSenseFromFlat,
  clearSensesCache,
  loadGlobalSenses,
  saveGlobalSenses,
  sensesFilePath,
  asFlatSense
} from '../../src/data/vocabulary/senses'
import { normalizeTopic } from '../../src/data/taxonomy'

interface AtlasExample {
  en?: string
  zh?: string
}

interface AtlasSense {
  pos?: string
  zh?: string
  en?: string
}

interface AtlasEntry {
  w: string
  uk?: string
  us?: string
  topic?: string
  cefr?: string
  ex?: AtlasExample[]
  senses?: AtlasSense[]
}

const ATLAS_DEFAULT = path.resolve(__dirname, '../../../../word-atlas/data/word-atlas.json')

function norm(word: string): string {
  return word.trim().toLowerCase().replace(/[’‘]/g, "'")
}

function loadAtlas(atlasPath: string): Map<string, AtlasEntry> {
  const raw = JSON.parse(fs.readFileSync(atlasPath, 'utf-8')) as AtlasEntry[]
  const map = new Map<string, AtlasEntry>()
  for (const entry of raw) {
    const key = norm(entry.w || '')
    if (key) map.set(key, entry)
  }
  return map
}

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const atlasIdx = args.indexOf('--atlas')
  const atlasPath = atlasIdx >= 0 ? args[atlasIdx + 1] : ATLAS_DEFAULT

  if (!fs.existsSync(atlasPath)) {
    console.error(`找不到词光文件: ${atlasPath}`)
    process.exit(1)
  }

  clearSensesCache()
  const lexicon = loadGlobalSenses()
  const atlas = loadAtlas(atlasPath)

  let created = 0
  let patched = 0
  let skippedVerified = 0
  let untouched = 0

  for (const [word, entry] of atlas.entries()) {
    const existing = lexicon[word]
    if (existing?.status === 'verified' || existing?.status === 'llm') {
      skippedVerified += 1
      continue
    }

    const flat = asFlatSense(existing)
    const sense0 = entry.senses?.[0]
    const basic = entry.ex?.[0]
    const exam = entry.ex?.[1] || (entry.ex || []).find(e => e.en && e.en !== basic?.en)

    const next = buildSenseFromFlat({
      meaning: flat.meaning || sense0?.zh?.trim() || '',
      englishMeaning: flat.englishMeaning || sense0?.en?.trim() || '',
      phonetic: flat.phonetic || entry.uk?.trim() || entry.us?.trim() || '',
      phoneticUk: entry.uk?.trim() || flat.phoneticUk,
      phoneticUs: entry.us?.trim() || flat.phoneticUs,
      exampleSentence: flat.exampleSentence || basic?.en?.trim() || '',
      exampleSentenceZh: flat.exampleSentenceZh || basic?.zh?.trim(),
      examExample: flat.examExample || exam?.en?.trim(),
      examExampleZh: flat.examExampleZh || exam?.zh?.trim(),
      topic: flat.topic || (entry.topic ? normalizeTopic(entry.topic) : undefined),
      cefr: flat.cefr || entry.cefr,
      pos: flat.pos || sense0?.pos?.trim(),
      status: 'pending',
      origin: flat.origin || 'word-atlas'
    })

    const before = JSON.stringify(existing || null)
    const after = JSON.stringify(next)
    if (before === after) {
      untouched += 1
      continue
    }

    lexicon[word] = next
    if (!existing) created += 1
    else patched += 1
  }

  console.log(`词光: ${atlas.size} 条`)
  console.log(`全局词典: ${Object.keys(lexicon).length} 条 → ${sensesFilePath()}`)
  console.log(`新建 ${created}, 补洞 ${patched}, 跳过已校验 ${skippedVerified}, 无变化 ${untouched}`)

  if (dryRun) {
    console.log('dry-run：未写入')
    return
  }

  saveGlobalSenses(lexicon)
  console.log('已写入 senses.json（嵌套结构；新/补洞均为 pending）')
}

main()
