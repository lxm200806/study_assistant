#!/usr/bin/env ts-node
/**
 * 用词书 gloss + 全局词典覆盖 KEW 成品字段。
 * 优先级：词书 gloss > senses.json 全局词典 > 成书原值
 *
 * 用法: npx ts-node --transpile-only scripts/vocabulary-import/polish-kew.ts [kew1200|kew4500|kew7200]
 */
import fs from 'fs'
import type { WordData, WordSources } from '../../src/data/vocabulary/types'
import { lookupSense } from '../../src/data/vocabulary/senses'
import { glossKey, loadNormalizedGlosses, validateGloss, type KewGloss } from './kew-gloss'
import { applyMergedToWord, mergeLexiconFields } from './merge-lexicon-fields'
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
  const tags = [
    `src:list=${sources.list}`,
    `src:meaning=${sources.meaning}`,
    `src:phonetic=${sources.phonetic}`,
    `src:english=${sources.englishMeaning}`,
    `src:example=${sources.example}`
  ]
  if (sources.examExample) tags.push(`src:exam=${sources.examExample}`)
  if (sources.topic) tags.push(`src:topic=${sources.topic}`)
  if (sources.cefr) tags.push(`src:cefr=${sources.cefr}`)
  return tags
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
  let fromGloss = 0
  let fromLexicon = 0

  book.words = book.words.map(item => {
    const key = glossKey(item.word)
    const gloss = glosses[key]
    if (!gloss) {
      issues.push(`缺义项 ${key}`)
      return item
    }
    fromGloss += 1
    const errors = validateGloss(item.word, gloss)
    if (errors.length) {
      issues.push(`${key}: ${errors.join('; ')}`)
    }

    const global = lookupSense(key)
    if (global) fromLexicon += 1

    const merged = mergeLexiconFields({
      gloss,
      global,
      existing: item,
      defaultSources: {
        list: layout.listSource,
        editor: layout.editor,
        englishMeaning: layout.englishMeaningSource(code),
        meaning: SENSE_SOURCES[key] || layout.editor
      }
    })

    const next = applyMergedToWord(item, merged)
    const tags = (item.tags || []).filter(tag => !tag.startsWith('src:') && tag !== PDF_NOTE)
    return {
      ...next,
      tags: [...tags, PDF_NOTE, ...sourceTags(next.sources!)]
    }
  })

  book.wordCount = book.words.length
  fs.writeFileSync(bookPath, `${JSON.stringify(book, null, 2)}\n`)
  return { count: book.words.length, issues, fromGloss, fromLexicon }
}

function polishSeries(layout: KewSeriesLayout) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const report: Record<string, unknown> = {}
  for (const code of layout.books) {
    const result = polishBook(layout, code)
    report[code] = result
    console.log(
      `${code}: ${result.count} 词, 问题 ${result.issues.length} 条, gloss ${result.fromGloss}, 命中全局 ${result.fromLexicon}`
    )
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
