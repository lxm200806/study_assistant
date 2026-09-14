#!/usr/bin/env ts-node
/**
 * 用义项表覆盖 KEW 词书的汉语、音标、英语解释、例句。
 * 用法: npx ts-node --transpile-only scripts/vocabulary-import/polish-kew.ts [kew1200|kew4500|kew7200]
 */
import fs from 'fs'
import type { WordData, WordSources } from '../../src/data/vocabulary/types'
import { glossKey, loadNormalizedGlosses, validateGloss, type KewGloss } from './kew-gloss'
import { REPORT_DIR, getKewLayout, resolveKewSeriesArgs, type KewSeriesLayout } from './kew-layout'

const PDF_NOTE = 'kew-student-pdf-image-only'

const SENSE_SOURCES: Record<string, string> = {
  fly: 'kew-unit-checked',
  tear: 'kew-unit-checked',
  watch: 'kew-unit-checked',
  iron: 'kew-unit-checked',
  major: 'kew-unit-checked',
  resolution: 'kew-unit-checked',
  sense: 'kew-unit-checked'
}

type GlossMap = Record<string, KewGloss>

function sourceTags(sources: WordSources): string[] {
  return [
    `src:list=${sources.list}`,
    `src:meaning=${sources.meaning}`,
    `src:phonetic=${sources.phonetic}`,
    `src:english=${sources.englishMeaning}`,
    `src:example=${sources.example}`
  ]
}

function loadGlossMap(layout: KewSeriesLayout, code: string): GlossMap {
  const file = layout.glossPath(code)
  if (!fs.existsSync(file)) {
    throw new Error(`缺少义项表: ${file}`)
  }
  return loadNormalizedGlosses(file)
}

function polishBook(layout: KewSeriesLayout, code: string) {
  const bookPath = layout.bookPath(code)
  const book = JSON.parse(fs.readFileSync(bookPath, 'utf-8')) as {
    code: string
    name: string
    words: WordData[]
    [key: string]: unknown
  }
  const glosses = loadGlossMap(layout, code)
  const issues: string[] = []

  book.words = book.words.map(item => {
    const key = glossKey(item.word)
    const gloss = glosses[key]
    if (!gloss) {
      issues.push(`缺义项 ${key}`)
      return item
    }
    const errors = validateGloss(item.word, gloss)
    if (errors.length) {
      issues.push(`${key}: ${errors.join('; ')}`)
    }
    const sources: WordSources = {
      list: layout.listSource,
      meaning: SENSE_SOURCES[key] || layout.editor,
      phonetic: layout.editor,
      englishMeaning: layout.englishMeaningSource(code),
      example: layout.editor
    }
    const tags = (item.tags || []).filter(tag => !tag.startsWith('src:') && tag !== PDF_NOTE)
    return {
      ...item,
      meaning: gloss.meaning,
      englishMeaning: gloss.englishMeaning,
      phonetic: gloss.phonetic,
      exampleSentence: gloss.exampleSentence,
      exampleSentences: gloss.exampleSentences,
      sources,
      tags: [...tags, PDF_NOTE, ...sourceTags(sources)]
    }
  })

  book.wordCount = book.words.length
  fs.writeFileSync(bookPath, `${JSON.stringify(book, null, 2)}\n`)
  return { count: book.words.length, issues }
}

function polishSeries(layout: KewSeriesLayout) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const report: Record<string, unknown> = {}
  for (const code of layout.books) {
    const result = polishBook(layout, code)
    report[code] = result
    console.log(`${code}: ${result.count} 词, 问题 ${result.issues.length} 条`)
    for (const issue of result.issues.slice(0, 20)) console.log(`  ${issue}`)
    if (result.issues.length > 20) console.log(`  ... 另有 ${result.issues.length - 20} 条`)
  }
  fs.writeFileSync(layout.reportPath, `${JSON.stringify(report, null, 2)}\n`)
}

function main() {
  for (const series of resolveKewSeriesArgs(process.argv.slice(2))) {
    polishSeries(getKewLayout(series))
  }
}

if (require.main === module) {
  main()
}
