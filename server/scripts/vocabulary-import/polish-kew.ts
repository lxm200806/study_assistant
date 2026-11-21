#!/usr/bin/env ts-node
/**
 * 从 units.json 重建 KEW 成品课表（瘦身形态：word + 单元 tags + senseKey）。
 * 释义一律以 senses.json 为准，同步时 hydrate；不再读取 *-glosses.json。
 *
 * 用法（server/ 下）:
 *   npm run paoguang:kew1200
 *   npm run paoguang:kew4500
 *   npm run paoguang:kew7200
 */
import fs from 'fs'
import type { WordData } from '../../src/data/vocabulary/types'
import {
  REPORT_DIR,
  getKewLayout,
  resolveKewSeriesArgs,
  type KewSeriesLayout
} from './kew-layout'
import {
  flattenKewBook,
  loadKewCatalog,
  validateKewBook
} from './parse-kew'

function rebuildSlimBook(layout: KewSeriesLayout, code: string) {
  const catalog = loadKewCatalog(layout.unitsPath)
  const source = catalog.books.find(b => b.code === code) || catalog.books[0]
  if (!source) throw new Error(`${layout.series}: units.json 里没有书 ${code}`)

  const errors = validateKewBook(source)
  const { words, duplicates } = flattenKewBook(source)

  const bookPath = layout.bookPath(code)
  const prev = fs.existsSync(bookPath)
    ? (JSON.parse(fs.readFileSync(bookPath, 'utf-8')) as Record<string, unknown>)
    : {}

  const slimWords: WordData[] = words.map(w => {
    const row: WordData = {
      word: w.word,
      tags: [...w.tags, `src:list=${layout.listSource}`]
    }
    if (w.senseKey) row.senseKey = w.senseKey
    if (w.senseLabel) row.senseLabel = w.senseLabel
    return row
  })

  const book = {
    ...prev,
    code: source.code,
    name: source.name,
    description: source.description,
    level: source.level,
    targetWordCount: source.targetWordCount,
    wordCount: slimWords.length,
    source: catalog.source || prev.source,
    words: slimWords
  }

  fs.writeFileSync(bookPath, `${JSON.stringify(book, null, 2)}\n`)
  return {
    count: slimWords.length,
    validateErrors: errors,
    duplicates: duplicates.length,
    bookPath
  }
}

function polishSeries(layout: KewSeriesLayout) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const report: Record<string, unknown> = {}
  for (const code of layout.books) {
    const result = rebuildSlimBook(layout, code)
    report[code] = result
    console.log(
      `${code}: 课表 ${result.count} 词（来自 units.json）→ ${result.bookPath}` +
        (result.validateErrors.length ? `；校验问题 ${result.validateErrors.length}` : '') +
        (result.duplicates ? `；跳过重复 ${result.duplicates}` : '')
    )
    for (const err of result.validateErrors.slice(0, 10)) console.log(`  ! ${err}`)
  }
  fs.writeFileSync(layout.reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log('释义请维护 senses.json，然后: npm run tongbu:cishu -- --force ' + layout.books.join(' '))
}

function main() {
  for (const series of resolveKewSeriesArgs(process.argv.slice(2))) {
    polishSeries(getKewLayout(series))
  }
}

if (require.main === module) {
  main()
}
