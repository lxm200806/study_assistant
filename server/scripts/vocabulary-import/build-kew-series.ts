#!/usr/bin/env ts-node
/**
 * 从 4500 / 7200 Key English Words 目录主题词构建词书 JSON
 * 用法: node ./node_modules/ts-node/dist/bin.js --transpile-only scripts/vocabulary-import/build-kew-series.ts [--api]
 */
import fs from 'fs'
import path from 'path'
import { parseKyleBingTxt } from './parse-kylebing'
import { loadEcdictCsv, ecdictToKyleBingMap } from './parse-ecdict'
import { enrichWord, loadEnCache, saveEnCache } from './enrich'
import { translateEnToZh } from './meaning-lookup'
import { validateBookWords } from './validate'
import { loadKewCatalog, flattenKewBook, validateKewBook } from './parse-kew'
import type { KewCatalog, KewWordRef } from './parse-kew'
import { resolveWordTaxonomy } from '../../src/data/taxonomy/word-tags'
import { emojiMap } from '../../src/utils/emojiMap'
import type { WordSources } from '../../src/data/vocabulary/types'

const ROOT = path.join(__dirname, '../..')
const SOURCES = path.join(ROOT, 'data/sources')
const OUT = path.join(ROOT, 'data/vocabulary/books')
const REPORT_DIR = path.join(SOURCES, 'kew/reports')
const useApi = process.argv.includes('--api')
const PDF_NOTE = 'kew-student-pdf-image-only'

const CATALOGS = [
  { file: 'kew/kew4500-units.json', listSource: 'kew4500-word-lists' },
  { file: 'kew/kew7200-units.json', listSource: 'kew7200-toc' }
]

function polishGloss(raw: { word: string; meaning: string; englishMeaning: string; phonetic: string; emoji?: string }) {
  const posOnly = /^(n|v|vt|vi|adj|adv|prep|det|pron)$/i
  let meaning = shortenChinese((raw.meaning || '').trim())
  const hasChinese = /[\u4e00-\u9fff]/.test(meaning)
  if (!hasChinese || meaning.startsWith('[待校对]')) {
    meaning = meaning && !meaning.startsWith('[待校对]') ? `${meaning}（${raw.word}）` : `[待校对] ${raw.word}`
  }
  let english = (raw.englishMeaning || '').trim()
  if (!english || english.length < 2 || posOnly.test(english) || /[\u4e00-\u9fff]/.test(english)) {
    english = hasChinese && !meaning.startsWith('[待校对]') ? `a listed target word: ${raw.word}` : raw.word
  }
  if (english.length < 2) english = raw.word
  return { ...raw, meaning, englishMeaning: english }
}

function shortenChinese(meaning: string): string {
  if (!meaning || meaning.startsWith('[待校对]')) return meaning
  const first = meaning.split(/[；;]/)[0]?.trim() || meaning
  return first.length > 28 ? first.slice(0, 28) : first
}

function makeExample(word: string, pos = ''): string {
  const p = pos.toLowerCase().replace(/\s+/g, '')
  if (p.includes('phr')) return `Please ${word} before you leave.`
  if ((p.startsWith('v') || p.includes('v.')) && !p.startsWith('vowel') && !p.includes('adv')) {
    return `They ${word} the idea in the meeting.`
  }
  if (p.includes('adj')) return `It was a ${word} example in class.`
  if (p.includes('adv')) return `She answered ${word} during the interview.`
  if (p.includes('prep')) return `Put the keys ${word} the table.`
  if (p.includes('conj')) return `Wait here ${word} I come back.`
  if (p.includes('pron')) return `${word} is waiting by the door.`
  return `Students study the word ${word} in this unit.`
}

function exampleContainsWord(word: string, example: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(example)
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

function meaningSource(ref: KewWordRef, meaning: string): string {
  if (ref.meaning) return 'kew-unit-checked'
  if (meaning.startsWith('[待校对]')) return 'pending'
  return 'editor-series'
}

async function buildCatalog(catalog: KewCatalog, listSource: string) {
  const report: Record<string, unknown> = {}

  for (const book of catalog.books) {
    console.log(`\n构建 ${book.name}...`)
    const { words: refs, duplicates } = flattenKewBook(book)
    if (duplicates.length) {
      console.log(`  同义项重复（已跳过）: ${duplicates.map(d => `${d.word} @ ${d.skippedUnit}`).join(', ')}`)
    }

    const enriched = []
    const dropped: string[] = []
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i]
      const raw = await enrichWord(ref.word, cnLookup, emojiMap, false)
      if (!raw) {
        dropped.push(ref.word)
        continue
      }
      let meaning = ref.meaning || raw.meaning
      const englishMeaning = ref.englishMeaning || raw.englishMeaning
      if (
        useApi &&
        (!meaning || meaning.startsWith('[待校对]')) &&
        englishMeaning &&
        !/[\u4e00-\u9fff]/.test(englishMeaning)
      ) {
        const translated = await translateEnToZh(englishMeaning)
        if (translated) meaning = translated
        await new Promise(resolve => setTimeout(resolve, 150))
      }
      const w = polishGloss({
        ...raw,
        meaning,
        englishMeaning,
        phonetic: ref.phonetic || raw.phonetic
      })
      let exampleSentence = makeExample(ref.word, ref.pos)
      if (!exampleContainsWord(ref.word, exampleSentence)) {
        exampleSentence = `The word ${ref.word} appears in this unit.`
      }
      const officialEnglish = Boolean(ref.englishMeaning)
      const sources: WordSources = {
        list: listSource,
        meaning: meaningSource(ref, w.meaning),
        phonetic: ref.phonetic ? 'kew-unit-checked' : 'editor-series',
        englishMeaning: officialEnglish ? listSource : 'editor-series',
        example: 'generated'
      }
      const tax = resolveWordTaxonomy(w.word, { tags: ref.tags })
      enriched.push({
        ...w,
        exampleSentence,
        senseKey: ref.senseKey,
        senseLabel: ref.senseLabel,
        contentType: tax.contentType,
        topic: tax.topic,
        sources,
        tags: [...new Set([...(tax.tags || []), ...ref.tags, PDF_NOTE, ...sourceTags(sources)])]
      })
      if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${refs.length}`)
    }

    const { valid, issues } = validateBookWords(enriched, { skipArtifactFilter: true })
    const pending = valid.filter(item => item.meaning.startsWith('[待校对]'))
    const bookJson = {
      code: book.code,
      name: book.name,
      description: book.description,
      level: book.level,
      targetWordCount: book.targetWordCount,
      wordCount: valid.length,
      source: catalog.source,
      words: valid
    }

    const outPath = path.join(OUT, `${book.code}.json`)
    fs.writeFileSync(outPath, `${JSON.stringify(bookJson, null, 2)}\n`)
    console.log(`✓ ${book.name}: ${valid.length} 词（单元展开 ${refs.length}）→ ${outPath}`)
    if (issues.length) console.log(`  校验提示: ${issues.length} 条`)
    if (pending.length) console.log(`  待校对中文: ${pending.length} 条`)
    if (dropped.length) console.log(`  enrich 丢弃: ${dropped.length} 条`)

    if (pending.length) {
      fs.mkdirSync(REPORT_DIR, { recursive: true })
      fs.writeFileSync(
        path.join(REPORT_DIR, `${book.code}-missing.txt`),
        pending.map(item => item.word).join('\n')
      )
    }

    report[book.code] = {
      parsed: refs.length,
      unique: valid.length,
      target: book.targetWordCount,
      duplicates: duplicates.length,
      issues: issues.length,
      pendingCn: pending.length,
      droppedInEnrich: dropped.length
    }
  }

  return report
}

let cnLookup: Map<string, { word: string; meaning: string; phonetic: string; englishMeaning?: string }>

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  loadEnCache()

  const cet4Txt = fs.readFileSync(path.join(SOURCES, 'cet4.txt'), 'utf-8')
  const cet6Txt = fs.readFileSync(path.join(SOURCES, 'cet6.txt'), 'utf-8')
  const toeflTxt = fs.readFileSync(path.join(SOURCES, 'toefl.txt'), 'utf-8')
  const zhongkaoTxt = fs.readFileSync(path.join(SOURCES, 'zhongkao.txt'), 'utf-8')
  const gaokaoTxt = fs.readFileSync(path.join(SOURCES, 'gaokao.txt'), 'utf-8')
  const ecdict = await loadEcdictCsv(path.join(SOURCES, 'ecdict.csv'))

  cnLookup = new Map([
    ...ecdictToKyleBingMap(ecdict),
    ...parseKyleBingTxt(cet4Txt),
    ...parseKyleBingTxt(cet6Txt),
    ...parseKyleBingTxt(toeflTxt),
    ...parseKyleBingTxt(gaokaoTxt),
    ...parseKyleBingTxt(zhongkaoTxt)
  ])

  const report: Record<string, unknown> = {}
  for (const item of CATALOGS) {
    const catalog = loadKewCatalog(path.join(SOURCES, item.file))
    const sourceErrors = catalog.books.flatMap(validateKewBook)
    if (sourceErrors.length) {
      console.error(`词表结构错误 (${item.file}):`)
      for (const err of sourceErrors) console.error(`  ${err}`)
      process.exit(1)
    }
    Object.assign(report, await buildCatalog(catalog, item.listSource))
  }

  saveEnCache()
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const reportPath = path.join(REPORT_DIR, 'kew-series-build-report.json')
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\n完成。报告: ${reportPath}`)
  console.log('重启后端以同步数据库: ./restart-server.sh')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
