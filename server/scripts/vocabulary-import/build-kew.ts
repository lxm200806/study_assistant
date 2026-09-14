#!/usr/bin/env ts-node
/**
 * 从 KEW 单元词表构建成品词书 JSON。构建后必须再跑 polish-kew.ts，否则会冲掉校对释义。
 * 用法: npx ts-node --transpile-only scripts/vocabulary-import/build-kew.ts [kew1200|kew4500|kew7200] [--api]
 */
import fs from 'fs'
import path from 'path'
import { loadEcdictCsv, ecdictToKyleBingMap } from './parse-ecdict'
import { enrichWord, loadEnCache, saveEnCache } from './enrich'
import { translateEnToZh } from './meaning-lookup'
import { validateBookWords } from './validate'
import { loadKewCatalog, flattenKewBook, validateKewBook } from './parse-kew'
import type { KewCatalog, KewWordRef } from './parse-kew'
import { resolveWordTaxonomy } from '../../src/data/taxonomy/word-tags'
import { emojiMap } from '../../src/utils/emojiMap'
import type { WordSources } from '../../src/data/vocabulary/types'
import { BOOKS_DIR, REPORT_DIR, getKewLayout, resolveKewSeriesArgs, type KewSeriesLayout } from './kew-layout'
import { makeExampleSentence, exampleContainsWord, sourceTags } from './book-word'
import { loadCnexamMeaningLookup } from './cnexam-layout'

const useApi = process.argv.includes('--api')
const PDF_NOTE = 'kew-student-pdf-image-only'
const SOURCES = path.join(__dirname, '../../data/sources')

type CnLookup = Map<string, { word: string; meaning: string; phonetic: string; englishMeaning?: string }>

function shortenChinese(meaning: string): string {
  if (!meaning || meaning.startsWith('[待校对]')) return meaning
  const first = meaning.split(/[；;]/)[0]?.trim() || meaning
  return first.length > 28 ? first.slice(0, 28) : first
}

function polishDraftGloss(
  raw: { word: string; meaning: string; englishMeaning: string; phonetic: string; emoji?: string },
  series: string
) {
  const posOnly = /^(n|v|vt|vi|adj|adv|prep|det|pron)$/i
  let meaning = series === 'kew1200' ? (raw.meaning || '').trim() : shortenChinese((raw.meaning || '').trim())
  const hasChinese = /[\u4e00-\u9fff]/.test(meaning)
  if (series === 'kew1200') {
    if (meaning.length < 2) {
      meaning = meaning ? `${meaning}（${raw.word}）` : `[待校对] ${raw.word}`
    }
  } else if (!hasChinese || meaning.startsWith('[待校对]')) {
    meaning = meaning && !meaning.startsWith('[待校对]') ? `${meaning}（${raw.word}）` : `[待校对] ${raw.word}`
  }
  let english = (raw.englishMeaning || '').trim()
  if (!english || english.length < 2 || posOnly.test(english) || /[\u4e00-\u9fff]/.test(english)) {
    if (series === 'kew1200') {
      english = meaning.length >= 2 ? meaning : raw.word
    } else {
      english = hasChinese && !meaning.startsWith('[待校对]') ? `a listed target word: ${raw.word}` : raw.word
    }
  }
  if (english.length < 2) english = raw.word
  return { ...raw, meaning, englishMeaning: english }
}

function meaningSource(ref: KewWordRef, meaning: string, editor: string): string {
  if (ref.meaning) return 'kew-unit-checked'
  if (meaning.startsWith('[待校对]')) return 'pending'
  return editor
}

async function buildCatalog(layout: KewSeriesLayout, catalog: KewCatalog, cnLookup: CnLookup) {
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
      const raw = await enrichWord(ref.word, cnLookup, emojiMap, layout.series === 'kew1200' ? useApi : false)
      if (!raw) {
        dropped.push(ref.word)
        continue
      }
      let meaning = ref.meaning || raw.meaning
      const englishMeaning = ref.englishMeaning || raw.englishMeaning
      if (
        layout.series !== 'kew1200' &&
        useApi &&
        (!meaning || meaning.startsWith('[待校对]')) &&
        englishMeaning &&
        !/[\u4e00-\u9fff]/.test(englishMeaning)
      ) {
        const translated = await translateEnToZh(englishMeaning)
        if (translated) meaning = translated
        await new Promise(resolve => setTimeout(resolve, 150))
      }
      const w = polishDraftGloss(
        {
          ...raw,
          meaning,
          englishMeaning,
          phonetic: ref.phonetic || raw.phonetic
        },
        layout.series
      )

      const tax = resolveWordTaxonomy(w.word, { tags: ref.tags })
      if (layout.series === 'kew1200') {
        enriched.push({
          ...w,
          senseKey: ref.senseKey,
          senseLabel: ref.senseLabel,
          contentType: tax.contentType,
          topic: tax.topic,
          tags: [...new Set([...(tax.tags || []), ...ref.tags])]
        })
      } else {
        let exampleSentence = makeExampleSentence(ref.word, ref.pos)
        if (!exampleContainsWord(ref.word, exampleSentence)) {
          exampleSentence = `The word ${ref.word} appears in this unit.`
        }
        const officialEnglish = Boolean(ref.englishMeaning)
        const sources: WordSources = {
          list: layout.listSource,
          meaning: meaningSource(ref, w.meaning, layout.editor),
          phonetic: ref.phonetic ? 'kew-unit-checked' : layout.editor,
          englishMeaning: officialEnglish ? layout.listSource : layout.editor,
          example: 'generated'
        }
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
      }
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

    const outPath = layout.bookPath(book.code)
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

async function loadCnLookup(): Promise<CnLookup> {
  const ecdict = await loadEcdictCsv(path.join(SOURCES, 'ecdict.csv'))
  return new Map([
    ...ecdictToKyleBingMap(ecdict),
    ...loadCnexamMeaningLookup()
  ])
}

async function main() {
  fs.mkdirSync(BOOKS_DIR, { recursive: true })
  loadEnCache()
  const cnLookup = await loadCnLookup()
  const report: Record<string, unknown> = {}

  for (const series of resolveKewSeriesArgs(process.argv.slice(2))) {
    const layout = getKewLayout(series)
    const catalog = loadKewCatalog(layout.unitsPath)
    const sourceErrors = catalog.books.flatMap(validateKewBook)
    if (sourceErrors.length) {
      console.error(`词表结构错误 (${layout.unitsPath}):`)
      for (const err of sourceErrors) console.error(`  ${err}`)
      process.exit(1)
    }
    Object.assign(report, await buildCatalog(layout, catalog, cnLookup))
  }

  saveEnCache()
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const reportPath = path.join(REPORT_DIR, 'kew-build-report.json')
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\n完成。报告: ${reportPath}`)
  console.log('构建后请跑 polish-kew.ts，再重启后端: ./restart-server.sh')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
