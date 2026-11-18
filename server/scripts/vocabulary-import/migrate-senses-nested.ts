#!/usr/bin/env ts-node
/**
 * 把 senses.json 从旧扁平字段压成嵌套结构（meanings[] / phonetic{uk,us,g} / level）。
 * 幂等：已是新结构的条目会再 normalize 一遍。
 *
 * 用法（在 server/ 下）：
 *   npm run cidian:yasuo
 *   npm run cidian:yasuo -- --dry-run
 */
import fs from 'fs'
import {
  asFlatSense,
  clearSensesCache,
  normalizeSenseEntry,
  saveGlobalSenses,
  sensesFilePath,
  type GlobalSense
} from '../../src/data/vocabulary/senses'

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const file = sensesFilePath()
  if (!fs.existsSync(file)) {
    console.error(`找不到 ${file}`)
    process.exit(1)
  }

  clearSensesCache()
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>
  const words = Object.keys(raw)
  let nestedAlready = 0
  let converted = 0
  const out: Record<string, GlobalSense> = {}

  for (const key of words) {
    const word = key.trim().toLowerCase()
    if (!word) continue
    const value = raw[key]
    const wasNested = !!(value && typeof value === 'object' && Array.isArray((value as any).meanings))
    const next = normalizeSenseEntry(value)
    out[word] = next
    if (wasNested) nestedAlready += 1
    else converted += 1
  }

  const sampleKey = Object.keys(out).sort()[0]
  const sample = sampleKey ? { word: sampleKey, entry: out[sampleKey], flat: asFlatSense(out[sampleKey]) } : null

  console.log(`条目 ${words.length}`)
  console.log(`已是嵌套 ${nestedAlready}, 本次从扁平转换 ${converted}`)
  if (sample) {
    console.log(`样例 ${sample.word}: meanings=${sample.entry.meanings.length}, level=${sample.entry.level || '-'}, status=${sample.entry.status}`)
  }

  if (dryRun) {
    console.log('dry-run：未写入')
    return
  }

  saveGlobalSenses(out)
  console.log(`已写入嵌套结构 → ${file}`)
}

main()
