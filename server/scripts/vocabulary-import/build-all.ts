#!/usr/bin/env ts-node
/**
 * 从权威词表构建四本书 JSON 并校验释义
 * 用法: npx ts-node scripts/vocabulary-import/build-all.ts [--api]
 */
import fs from 'fs'
import path from 'path'
import { parseCambridgePdfText } from './parse-cambridge'
import { parseKyleBingTxt } from './parse-kylebing'
import { loadEcdictCsv, ecdictToKyleBingMap } from './parse-ecdict'
import { enrichWord, loadEnCache, saveEnCache } from './enrich'
import { validateBookWords } from './validate'
import { resolveWordTaxonomy } from '../../src/data/taxonomy/word-tags'
import { emojiMap } from '../../src/utils/emojiMap'

const ROOT = path.join(__dirname, '../..')
const SOURCES = path.join(ROOT, 'data/sources')
const OUT = path.join(ROOT, 'data/vocabulary/books')

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
    code: 'ket',
    name: 'KET词汇',
    description: '剑桥 A2 Key 官方词表（2025）',
    level: 'A2',
    targetWordCount: 1599,
    source: 'cambridge-a2-key-2025'
  },
  {
    code: 'pet',
    name: 'PET词汇',
    description: '剑桥 B1 Preliminary 官方词表（2025）',
    level: 'B1',
    targetWordCount: 3046,
    source: 'cambridge-b1-preliminary-2025'
  },
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

  const cet4Txt = fs.readFileSync(path.join(SOURCES, 'cet4.txt'), 'utf-8')
  const cet6Txt = fs.readFileSync(path.join(SOURCES, 'cet6.txt'), 'utf-8')
  const toeflTxt = fs.readFileSync(path.join(SOURCES, 'toefl.txt'), 'utf-8')
  const zhongkaoTxt = fs.readFileSync(path.join(SOURCES, 'zhongkao.txt'), 'utf-8')
  const gaokaoTxt = fs.readFileSync(path.join(SOURCES, 'gaokao.txt'), 'utf-8')
  const ketTxt = fs.readFileSync(path.join(SOURCES, 'ket-vocabulary-pdf.txt'), 'utf-8')
  const petTxt = fs.readFileSync(path.join(SOURCES, 'pet-vocabulary-pdf.txt'), 'utf-8')

  const ecdict = await loadEcdictCsv(path.join(SOURCES, 'ecdict.csv'))

  // 释义优先级：ECDICT/托福/六级/四级 < 高中 < 初中（后者覆盖前者）
  const cnLookup = new Map([
    ...ecdictToKyleBingMap(ecdict),
    ...parseKyleBingTxt(cet4Txt),
    ...parseKyleBingTxt(cet6Txt),
    ...parseKyleBingTxt(toeflTxt),
    ...parseKyleBingTxt(gaokaoTxt),
    ...parseKyleBingTxt(zhongkaoTxt)
  ])

  const ketWords = parseCambridgePdfText(ketTxt)
  const petWords = parseCambridgePdfText(petTxt)
  const zhongkaoWords = [...parseKyleBingTxt(zhongkaoTxt).keys()]
  const gaokaoWords = [...parseKyleBingTxt(gaokaoTxt).keys()]

  console.log(`KET 解析: ${ketWords.length} 词`)
  console.log(`PET 解析: ${petWords.length} 词`)
  console.log(`初中: ${zhongkaoWords.length} 词`)
  console.log(`高中: ${gaokaoWords.length} 词`)

  const wordLists: Record<string, string[]> = {
    ket: ketWords,
    pet: petWords,
    zhongkao: zhongkaoWords,
    gaokao: gaokaoWords
  }

  const report: Record<string, unknown> = {}

  for (const meta of BOOKS) {
    console.log(`\n构建 ${meta.name}...`)
    const list = wordLists[meta.code]
    const enriched = []
    const needApi = useApi && (meta.code === 'ket' || meta.code === 'pet')

    for (let i = 0; i < list.length; i++) {
      const w = await enrichWord(list[i], cnLookup, emojiMap, needApi)
      if (w) {
        const tax = resolveWordTaxonomy(w.word)
        enriched.push({
          ...w,
          contentType: tax.contentType,
          topic: tax.topic,
          tags: tax.tags || []
        })
      }
      if ((i + 1) % 200 === 0) console.log(`  ${i + 1}/${list.length}`)
    }

    const { valid, issues } = validateBookWords(enriched)
    const pending = valid.filter(w => w.meaning.startsWith('[待校对]'))

    const bookJson = {
      ...meta,
      wordCount: valid.length,
      words: valid
    }

    const outPath = path.join(OUT, `${meta.code}.json`)
    fs.writeFileSync(outPath, JSON.stringify(bookJson, null, 0))
    console.log(`✓ ${meta.name}: ${valid.length} 词 → ${outPath}`)
    if (issues.length) console.log(`  校验提示: ${issues.length} 条`)
    if (pending.length) console.log(`  待校对中文: ${pending.length} 条 (可重新运行 --api 或人工补全)`)

    report[meta.code] = {
      total: valid.length,
      issues: issues.length,
      pendingCn: pending.length
    }
  }

  saveEnCache()
  fs.writeFileSync(path.join(OUT, 'build-report.json'), JSON.stringify(report, null, 2))
  console.log('\n完成。重启后端以同步数据库: ./start-server.sh')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
