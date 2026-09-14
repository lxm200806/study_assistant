#!/usr/bin/env ts-node
/**
 * 从剑桥官网 MSE 官方词表构建 mse-ket / mse-pet。
 * 用法: npx ts-node --transpile-only scripts/vocabulary-import/build-mse.ts [mse-ket|mse-pet] [--api]
 */
import fs from 'fs'
import path from 'path'
import { loadEcdictCsv, ecdictToKyleBingMap } from './parse-ecdict'
import { enrichWord, loadEnCache, saveEnCache } from './enrich'
import { validateBookWords } from './validate'
import { parseCambridgePdfText } from './parse-cambridge'
import { resolveWordTaxonomy } from '../../src/data/taxonomy/word-tags'
import { emojiMap } from '../../src/utils/emojiMap'
import { completeWordData, upsertGlossFile, applyGlosses } from './book-word'
import { loadCnexamMeaningLookup } from './cnexam-layout'
import {
  BOOKS_DIR,
  MSE_BOOKS,
  MSE_LIST_SOURCE,
  MSE_META,
  TMP_DIR,
  mseBookPath,
  mseGlossPath,
  mseSourcePath,
  mseWordListPath,
  type MseBook
} from './mse-layout'

const ROOT = path.join(__dirname, '../..')
const SOURCES = path.join(ROOT, 'data/sources')
const useApi = process.argv.includes('--api')

function resolveBooks(argv: string[]): MseBook[] {
  const args = argv.filter(arg => !arg.startsWith('--') && !arg.endsWith('.ts') && !/[\\/]/.test(arg))
  if (!args.length) return [...MSE_BOOKS]
  return args.map(arg => {
    const code = arg.toLowerCase().replace(/_/g, '-') as MseBook
    if (!MSE_BOOKS.includes(code)) throw new Error(`未知书号: ${arg}（可用: ${MSE_BOOKS.join(', ')}）`)
    return code
  })
}

async function main() {
  fs.mkdirSync(BOOKS_DIR, { recursive: true })
  fs.mkdirSync(TMP_DIR, { recursive: true })
  loadEnCache()

  const ecdict = await loadEcdictCsv(path.join(SOURCES, 'ecdict.csv'))
  const cnLookup = new Map([
    ...ecdictToKyleBingMap(ecdict),
    ...loadCnexamMeaningLookup()
  ])

  const report: Record<string, unknown> = {}

  for (const code of resolveBooks(process.argv.slice(2))) {
    const meta = MSE_META[code]
    const sourcePath = mseSourcePath(code)
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`缺少官方词表文本: ${sourcePath}（先跑 extract-mse-pdf.py）`)
    }
    const words = parseCambridgePdfText(fs.readFileSync(sourcePath, 'utf-8'))
    fs.writeFileSync(mseWordListPath(code), `${JSON.stringify(words, null, 2)}\n`)
    console.log(`\n构建 ${meta.name}: 官方主题词 ${words.length} 个`)

    const enriched = []
    const dropped: string[] = []
    for (let i = 0; i < words.length; i++) {
      const raw = words[i]
      const item = await enrichWord(raw, cnLookup, emojiMap, useApi)
      const fallback = {
        word: raw,
        meaning: `[待校对] ${raw}`,
        phonetic: '',
        englishMeaning: `a listed target word: ${raw}`
      }
      const row = item || fallback
      if (!item) dropped.push(raw)
      const tax = resolveWordTaxonomy(row.word)
      enriched.push(
        completeWordData(
          {
            ...row,
            meaning: row.meaning && row.meaning.length >= 1 ? row.meaning : fallback.meaning,
            englishMeaning:
              row.englishMeaning && row.englishMeaning.length >= 2
                ? row.englishMeaning
                : fallback.englishMeaning,
            phonetic: row.phonetic || `/${raw}/`,
            contentType: tax.contentType,
            topic: tax.topic,
            tags: tax.tags || []
          },
          MSE_LIST_SOURCE
        )
      )
      if ((i + 1) % 200 === 0) console.log(`  ${i + 1}/${words.length}`)
    }

    const { valid, issues } = validateBookWords(enriched, { skipArtifactFilter: true })
    const glossPath = mseGlossPath(code)
    const glossAdded = upsertGlossFile(glossPath, valid)
    const glosses = JSON.parse(fs.readFileSync(glossPath, 'utf-8'))
    const wordsWithGloss = applyGlosses(valid, glosses, MSE_LIST_SOURCE)
    const pending = wordsWithGloss.filter(item => item.meaning.startsWith('[待校对]'))
    const bookJson = {
      ...meta,
      targetWordCount: wordsWithGloss.length,
      wordCount: wordsWithGloss.length,
      words: wordsWithGloss
    }
    const outPath = mseBookPath(code)
    fs.writeFileSync(outPath, `${JSON.stringify(bookJson, null, 2)}\n`)
    console.log(`✓ ${meta.name}: ${wordsWithGloss.length} 词 → ${outPath}`)
    if (glossAdded) console.log(`  新增 gloss: ${glossAdded} 条`)
    if (issues.length) console.log(`  校验提示: ${issues.length} 条`)
    if (pending.length) console.log(`  待校对中文: ${pending.length} 条`)
    if (dropped.length) console.log(`  enrich 丢弃: ${dropped.length} 条`)

    if (pending.length) {
      fs.writeFileSync(path.join(TMP_DIR, `${code}-missing.txt`), pending.map(item => item.word).join('\n'))
    }

    report[code] = {
      parsed: words.length,
      unique: valid.length,
      issues: issues.length,
      pendingCn: pending.length,
      droppedInEnrich: dropped.length
    }
  }

  saveEnCache()
  fs.writeFileSync(path.join(TMP_DIR, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\n完成。报告: ${path.join(TMP_DIR, 'build-report.json')}`)
  console.log('同步数据库: bash ../scripts/sync-vocabulary.sh && ./restart-server.sh')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
