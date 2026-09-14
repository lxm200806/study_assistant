#!/usr/bin/env ts-node
/**
 * 从国内考试词表构建中考/高考词书 JSON 并校验释义
 * 用法: npx ts-node scripts/vocabulary-import/build-all.ts [--api]
 */
import fs from 'fs'
import path from 'path'
import { loadEcdictCsv, ecdictToKyleBingMap } from './parse-ecdict'
import { enrichWord, loadEnCache, saveEnCache } from './enrich'
import { validateBookWords } from './validate'
import { resolveWordTaxonomy } from '../../src/data/taxonomy/word-tags'
import { emojiMap } from '../../src/utils/emojiMap'
import { completeWordData } from './book-word'
import { BOOKS_DIR, TMP_DIR } from './kew-layout'
import { loadCnexamMeaningLookup, cnexamGlossWords } from './cnexam-layout'

const ROOT = path.join(__dirname, '../..')
const SOURCES = path.join(ROOT, 'data/sources')
const OUT = BOOKS_DIR
const REPORT_DIR = path.join(TMP_DIR, 'vocabulary')

const useApi = process.argv.includes('--api')

interface BookMeta {
  code: string
  name: string
  description: string
  level: string
  targetWordCount: number
  source: string
}

const BOOKS: BookMeta[] = [
  {
    code: 'zhongkao',
    name: '初中词汇',
    description: '新课标中考英语核心词汇（KyleBing/考纲整理）',
    level: '初中',
    targetWordCount: 1600,
    source: 'kylebing-junior'
  },
  {
    code: 'gaokao',
    name: '高中词汇',
    description: '高考英语考纲词汇（KyleBing/课标整理）',
    level: '高中',
    targetWordCount: 3500,
    source: 'kylebing-senior'
  }
]

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  loadEnCache()

  const ecdict = await loadEcdictCsv(path.join(SOURCES, 'ecdict.csv'))

  // 释义优先级：ECDICT < 国内考试 gloss（中考覆盖高考/四六级）
  const cnLookup = new Map([
    ...ecdictToKyleBingMap(ecdict),
    ...loadCnexamMeaningLookup()
  ])

  const zhongkaoWords = cnexamGlossWords('zhongkao')
  const gaokaoWords = cnexamGlossWords('gaokao')

  console.log(`初中: ${zhongkaoWords.length} 词`)
  console.log(`高中: ${gaokaoWords.length} 词`)

  const wordLists: Record<string, string[]> = {
    zhongkao: zhongkaoWords,
    gaokao: gaokaoWords
  }

  const report: Record<string, unknown> = {}

  for (const meta of BOOKS) {
    console.log(`\n构建 ${meta.name}...`)
    const list = wordLists[meta.code]
    const parsedCount = list.length
    const enriched = []
    const droppedInEnrich: string[] = []
    const needApi = useApi

    for (let i = 0; i < list.length; i++) {
      const w = await enrichWord(list[i], cnLookup, emojiMap, needApi)
      if (w) {
        const tax = resolveWordTaxonomy(w.word)
        enriched.push(
          completeWordData(
            {
              ...w,
              contentType: tax.contentType,
              topic: tax.topic,
              tags: tax.tags || []
            },
            meta.source
          )
        )
      } else {
        droppedInEnrich.push(list[i])
      }
      if ((i + 1) % 200 === 0) console.log(`  ${i + 1}/${list.length}`)
    }

    const { valid, issues } = validateBookWords(enriched)
    const parseRejected = issues.filter(i => i.reason.includes('解析错误')).length
    const pending = valid.filter(w => w.meaning.startsWith('[待校对]'))
    const missingWords = valid.filter(w => w.meaning.startsWith('[待校对]'))

    const bookJson = {
      ...meta,
      targetWordCount: valid.length,
      wordCount: valid.length,
      words: valid
    }

    const outPath = path.join(OUT, `${meta.code}.json`)
    fs.writeFileSync(outPath, JSON.stringify(bookJson, null, 0))
    console.log(`✓ ${meta.name}: ${valid.length} 词 (解析 ${parsedCount}) → ${outPath}`)
    if (issues.length) console.log(`  校验提示: ${issues.length} 条`)
    if (pending.length) console.log(`  待校对中文: ${pending.length} 条`)
    if (droppedInEnrich.length) console.log(`  enrich 丢弃: ${droppedInEnrich.length} 条`)

    if (missingWords.length) {
      fs.mkdirSync(REPORT_DIR, { recursive: true })
      const missingPath = path.join(REPORT_DIR, `${meta.code}-missing.txt`)
      fs.writeFileSync(missingPath, missingWords.map(w => w.word).join('\n'))
    }

    report[meta.code] = {
      parsed: parsedCount,
      total: valid.length,
      target: meta.targetWordCount,
      gap: meta.targetWordCount - valid.length,
      issues: issues.length,
      pendingCn: pending.length,
      parseRejected,
      droppedInEnrich: droppedInEnrich.length
    }
  }

  saveEnCache()
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const reportPath = path.join(REPORT_DIR, 'build-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n完成。报告: ${reportPath}`)
  console.log('重启后端以同步数据库: ./restart-server.sh')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
