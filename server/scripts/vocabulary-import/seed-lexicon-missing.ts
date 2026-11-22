#!/usr/bin/env ts-node
/**
 * 新开/导入词书时：对照全局词典，列出缺失词；可写入全局为 pending。
 *
 * 用法（在 server/ 下）：
 *   npm run cidian:quezi -- kew1200
 *   npm run cidian:quezi -- kew1200 --write
 *   npm run cidian:quezi -- kew1200 --write --from-book
 *
 * 默认从 units.json 取词序；--from-book 则从成品 books/*.json 取词并带上已有字段。
 */
import fs from 'fs'
import path from 'path'
import {
  buildSenseFromFlat,
  clearSensesCache,
  loadGlobalSenses,
  saveGlobalSenses,
  sensesFilePath
} from '../../src/data/vocabulary/senses'
import {
  BOOKS_DIR,
  REPORT_DIR,
  SERVER_ROOT,
  getKewLayout,
  isKewSeries,
  KEW_SERIES,
  parseKewSeries,
  type KewSeries
} from './kew-layout'
import { loadCurriculumBook, unitsPath } from './curriculum'
import { loadKewCatalog, normalizeKewWord, unitItems } from './parse-kew'

type WordSeed = {
  word: string
  meaning?: string
  englishMeaning?: string
  phonetic?: string
  exampleSentence?: string
  exampleSentenceZh?: string
  examExample?: string
  examExampleZh?: string
  topic?: string
  cefr?: string
}

function wordsFromUnits(series: KewSeries): WordSeed[] {
  const layout = getKewLayout(series)
  const catalog = loadKewCatalog(layout.unitsPath)
  const seen = new Set<string>()
  const out: WordSeed[] = []
  for (const book of catalog.books) {
    for (const unit of book.units) {
      for (const item of unitItems(unit)) {
        const word = normalizeKewWord(item.word)
        if (!word || seen.has(word)) continue
        seen.add(word)
        out.push({
          word,
          englishMeaning: item.englishMeaning
        })
      }
    }
  }
  return out
}

function wordsFromBookJson(code: string): WordSeed[] {
  const file = path.join(BOOKS_DIR, `${code}.json`)
  if (!fs.existsSync(file)) throw new Error(`缺少成品书: ${file}`)
  const book = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    words: Array<{
      word: string
      meaning?: string
      englishMeaning?: string
      phonetic?: string
      exampleSentence?: string
      topic?: string
      cefr?: string
      examples?: Array<{ role?: string; en?: string; zh?: string }>
    }>
  }
  return (book.words || []).map(w => {
    const exam = (w.examples || []).find(e => e.role === 'exam')
    const basic = (w.examples || []).find(e => e.role === 'basic')
    return {
      word: w.word.trim().toLowerCase(),
      meaning: w.meaning,
      englishMeaning: w.englishMeaning,
      phonetic: w.phonetic,
      exampleSentence: w.exampleSentence || basic?.en,
      exampleSentenceZh: basic?.zh,
      examExample: exam?.en,
      examExampleZh: exam?.zh,
      topic: w.topic,
      cefr: w.cefr
    }
  })
}

type GlossMap = Record<string, { phonetic?: string; meaning?: string; englishMeaning?: string }>

function loadGlosses(code: string): GlossMap {
  const candidates = [
    path.join(SERVER_ROOT, 'data/sources/pep', `${code}-glosses.json`),
    path.join(SERVER_ROOT, 'data/sources', code, 'glosses.json'),
    path.join(SERVER_ROOT, 'data/vocabulary/glosses', `${code}.json`)
  ]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as GlossMap
  }
  return {}
}

/** 任意已有 units 的词书：从单元表取词，并用 glosses 补中文/音标 */
function wordsFromCurriculumUnits(code: string): WordSeed[] {
  const book = loadCurriculumBook(code)
  const gloss = loadGlosses(code)
  const seen = new Set<string>()
  const out: WordSeed[] = []
  for (const unit of book.units) {
    for (const item of unitItems(unit)) {
      const word = normalizeKewWord(item.word)
      if (!word || seen.has(word)) continue
      seen.add(word)
      const g = gloss[word]
      out.push({
        word,
        meaning: g?.meaning || '',
        englishMeaning: g?.englishMeaning || item.englishMeaning || '',
        phonetic: g?.phonetic || ''
      })
    }
  }
  return out
}

function main() {
  const args = process.argv.slice(2).filter(a => !a.endsWith('.ts'))
  const write = args.includes('--write')
  const fromBook = args.includes('--from-book')
  const codes = args.filter(a => !a.startsWith('--'))
  if (!codes.length) {
    console.error(`用法: npm run cidian:quezi -- <kew1200|mse-ket|pep-g3a-2024|...> [--write] [--from-book]`)
    console.error(`KEW 套系: ${KEW_SERIES.join(', ')}`)
    process.exit(1)
  }

  clearSensesCache()
  const lexicon = loadGlobalSenses()
  fs.mkdirSync(REPORT_DIR, { recursive: true })

  for (const code of codes) {
    let seeds: WordSeed[] = []
    if (isKewSeries(code) && !fromBook) {
      seeds = wordsFromUnits(parseKewSeries(code))
    } else if (fromBook) {
      seeds = wordsFromBookJson(code)
    } else if (fs.existsSync(unitsPath(code))) {
      seeds = wordsFromCurriculumUnits(code)
    } else {
      seeds = wordsFromBookJson(code)
    }

    const missing: WordSeed[] = []
    const present: string[] = []
    for (const seed of seeds) {
      if (lexicon[seed.word]) present.push(seed.word)
      else missing.push(seed)
    }

    console.log(`\n${code}: 词表 ${seeds.length}, 全局已有 ${present.length}, 缺失 ${missing.length}`)
    for (const m of missing.slice(0, 40)) console.log(`  + ${m.word}`)
    if (missing.length > 40) console.log(`  ... 另有 ${missing.length - 40} 个`)

    const reportPath = path.join(REPORT_DIR, `${code}-lexicon-missing.json`)
    fs.writeFileSync(
      reportPath,
      `${JSON.stringify({ code, total: seeds.length, present: present.length, missing: missing.map(m => m.word) }, null, 2)}\n`
    )
    console.log(`报告: ${reportPath}`)

    if (!write) {
      console.log('未写入。加上 --write 会把缺失词追加进全局词典（status=pending）。')
      continue
    }

    let added = 0
    for (const seed of missing) {
      lexicon[seed.word] = buildSenseFromFlat({
        meaning: seed.meaning?.trim() || '',
        englishMeaning: seed.englishMeaning?.trim() || '',
        phonetic: seed.phonetic?.trim() || '',
        exampleSentence: seed.exampleSentence?.trim() || '',
        exampleSentenceZh: seed.exampleSentenceZh?.trim(),
        examExample: seed.examExample?.trim(),
        examExampleZh: seed.examExampleZh?.trim(),
        topic: seed.topic?.trim(),
        cefr: seed.cefr?.trim(),
        status: 'pending',
        origin: `seed:${code}`
      })
      added += 1
    }
    saveGlobalSenses(lexicon)
    console.log(`已写入 pending ${added} 条 → ${sensesFilePath()}`)
    console.log('下一步: npm run cidian:jiaoyan ，校验后再 paoguang / cidian:tianchong / tongbu:cishu')
  }
}

main()
