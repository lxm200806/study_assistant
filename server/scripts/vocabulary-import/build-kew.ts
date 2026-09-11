#!/usr/bin/env ts-node
/**
 * 从 1200 Key English Words 目录主题词构建三本词书 JSON
 * 用法: npx ts-node scripts/vocabulary-import/build-kew.ts [--api]
 */
import fs from 'fs'
import path from 'path'
import { parseKyleBingTxt } from './parse-kylebing'
import { loadEcdictCsv, ecdictToKyleBingMap } from './parse-ecdict'
import { enrichWord, loadEnCache, saveEnCache } from './enrich'
import { validateBookWords } from './validate'
import { loadKewCatalog, flattenKewBook, validateKewBook } from './parse-kew'
import { resolveWordTaxonomy } from '../../src/data/taxonomy/word-tags'
import { emojiMap } from '../../src/utils/emojiMap'

const ROOT = path.join(__dirname, '../..')
const SOURCES = path.join(ROOT, 'data/sources')
const OUT = path.join(ROOT, 'data/vocabulary/books')
const useApi = process.argv.includes('--api')

function polishGloss(raw: { word: string; meaning: string; englishMeaning: string; phonetic: string; emoji?: string }) {
  const posOnly = /^(n|v|vt|vi|adj|adv|prep|det|pron)$/i
  let meaning = (raw.meaning || '').trim()
  if (meaning.length < 2) {
    meaning = meaning ? `${meaning}（${raw.word}）` : `[待校对] ${raw.word}`
  }
  let english = (raw.englishMeaning || '').trim()
  if (!english || english.length < 2 || posOnly.test(english)) {
    english = meaning.length >= 2 ? meaning : raw.word
  }
  if (english.length < 2) english = raw.word
  return { ...raw, meaning, englishMeaning: english }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  loadEnCache()

  const catalog = loadKewCatalog()
  const sourceErrors = catalog.books.flatMap(validateKewBook)
  if (sourceErrors.length) {
    console.error('词表结构错误:')
    for (const err of sourceErrors) console.error(`  ${err}`)
    process.exit(1)
  }

  const cet4Txt = fs.readFileSync(path.join(SOURCES, 'cet4.txt'), 'utf-8')
  const cet6Txt = fs.readFileSync(path.join(SOURCES, 'cet6.txt'), 'utf-8')
  const toeflTxt = fs.readFileSync(path.join(SOURCES, 'toefl.txt'), 'utf-8')
  const zhongkaoTxt = fs.readFileSync(path.join(SOURCES, 'zhongkao.txt'), 'utf-8')
  const gaokaoTxt = fs.readFileSync(path.join(SOURCES, 'gaokao.txt'), 'utf-8')
  const ecdict = await loadEcdictCsv(path.join(SOURCES, 'ecdict.csv'))

  const cnLookup = new Map([
    ...ecdictToKyleBingMap(ecdict),
    ...parseKyleBingTxt(cet4Txt),
    ...parseKyleBingTxt(cet6Txt),
    ...parseKyleBingTxt(toeflTxt),
    ...parseKyleBingTxt(gaokaoTxt),
    ...parseKyleBingTxt(zhongkaoTxt)
  ])

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
      const raw = await enrichWord(ref.word, cnLookup, emojiMap, useApi)
      if (!raw) {
        dropped.push(ref.word)
        continue
      }
      const w = polishGloss({
        ...raw,
        meaning: ref.meaning || raw.meaning,
        englishMeaning: ref.englishMeaning || raw.englishMeaning,
        phonetic: ref.phonetic || raw.phonetic
      })
      const tax = resolveWordTaxonomy(w.word, { tags: ref.tags })
      enriched.push({
        ...w,
        senseKey: ref.senseKey,
        senseLabel: ref.senseLabel,
        contentType: tax.contentType,
        topic: tax.topic,
        tags: [...new Set([...(tax.tags || []), ...ref.tags])]
      })
      if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${refs.length}`)
    }

    const { valid, issues } = validateBookWords(enriched, { skipArtifactFilter: true })
    const pending = valid.filter(w => w.meaning.startsWith('[待校对]'))
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
    fs.writeFileSync(outPath, JSON.stringify(bookJson, null, 0))
    console.log(`✓ ${book.name}: ${valid.length} 词（单元展开 ${refs.length}）→ ${outPath}`)
    if (issues.length) console.log(`  校验提示: ${issues.length} 条`)
    if (pending.length) console.log(`  待校对中文: ${pending.length} 条`)
    if (dropped.length) console.log(`  enrich 丢弃: ${dropped.length} 条`)

    if (pending.length) {
      fs.writeFileSync(
        path.join(OUT, `${book.code}-missing.txt`),
        pending.map(w => w.word).join('\n')
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

  saveEnCache()
  const reportPath = path.join(OUT, 'kew-build-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n完成。报告: ${reportPath}`)
  console.log('重启后端以同步数据库: ./restart-server.sh')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
