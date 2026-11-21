#!/usr/bin/env ts-node
/**
 * 编排课表（取代旧「抛光」）：从统一单元表生成 books/<code>.json。
 * 所有词书同一流程。
 *
 *   npm run cishu:bianpai
 *   npm run cishu:bianpai -- kew1200 mse-ket
 *   npm run cishu:bianpai -- --init
 *   npm run cishu:bianpai -- --init-only
 */
import fs from 'fs'
import path from 'path'
import {
  BIANPAI_REPORT_DIR,
  bookJsonPath,
  bookJsonToCurriculum,
  curriculumToSlimWords,
  defaultListSource,
  loadCurriculumBook,
  resolveBookCodes,
  saveCurriculumBook,
  unitsPath,
  UNITS_DIR,
  type CurriculumBook
} from './curriculum'
import { flattenKewBook, loadKewCatalog } from './parse-kew'
import { getKewLayout, isKewSeries } from './kew-layout'

function migrateKewUnitsIfNeeded(code: string) {
  if (!isKewSeries(code)) return
  const dest = unitsPath(code)
  if (fs.existsSync(dest)) return
  const layout = getKewLayout(code)
  if (!fs.existsSync(layout.unitsPath)) return
  const catalog = loadKewCatalog(layout.unitsPath)
  const source = catalog.books.find(b => b.code === code) || catalog.books[0]
  if (!source) return
  const { words } = flattenKewBook(source)
  const senseOverrides: NonNullable<CurriculumBook['senseOverrides']> = {}
  for (const w of words) {
    if (w.senseKey) {
      senseOverrides[w.word] = { senseKey: w.senseKey, senseLabel: w.senseLabel }
    }
  }
  const book: CurriculumBook = {
    code: source.code,
    name: source.name,
    description: source.description,
    level: source.level,
    targetWordCount: source.targetWordCount,
    source: catalog.source,
    listSource: defaultListSource(code),
    units: source.units,
    ...(Object.keys(senseOverrides).length ? { senseOverrides } : {})
  }
  saveCurriculumBook(book)
  console.log(`已从 KEW 源迁移单元表 → ${dest}`)
}

function ensureUnits(code: string, init: boolean): boolean {
  migrateKewUnitsIfNeeded(code)
  if (fs.existsSync(unitsPath(code))) return true
  if (!init) {
    console.error(`缺少 ${unitsPath(code)}。可加 --init 从现有 books 生成。`)
    return false
  }
  const curriculum = bookJsonToCurriculum(code)
  saveCurriculumBook(curriculum)
  console.log(`已初始化单元表 → ${unitsPath(code)}`)
  return true
}

function arrangeOne(code: string) {
  const curriculum = loadCurriculumBook(code)
  const slim = curriculumToSlimWords(curriculum)
  const bookPath = bookJsonPath(code)
  const prev = fs.existsSync(bookPath)
    ? (JSON.parse(fs.readFileSync(bookPath, 'utf-8')) as Record<string, unknown>)
    : {}

  const next = {
    ...prev,
    code: curriculum.code,
    name: curriculum.name,
    description: curriculum.description,
    level: curriculum.level,
    targetWordCount: curriculum.targetWordCount,
    wordCount: slim.length,
    source: curriculum.source || prev.source,
    words: slim
  }
  fs.writeFileSync(bookPath, `${JSON.stringify(next, null, 2)}\n`)
  return { code, count: slim.length, bookPath, unitsPath: unitsPath(code) }
}

function main() {
  const argv = process.argv.slice(2)
  const init = argv.includes('--init') || argv.includes('--init-only')
  const initOnly = argv.includes('--init-only')
  const codes = resolveBookCodes(argv)

  fs.mkdirSync(UNITS_DIR, { recursive: true })
  fs.mkdirSync(BIANPAI_REPORT_DIR, { recursive: true })

  console.log(`编排课表（cishu:bianpai）：${codes.join(', ')}${init ? ' [--init]' : ''}`)

  const report: Record<string, unknown> = {}
  for (const code of codes) {
    if (!ensureUnits(code, init)) {
      process.exitCode = 1
      continue
    }
    if (initOnly) {
      report[code] = { unitsPath: unitsPath(code), initOnly: true }
      continue
    }
    const result = arrangeOne(code)
    report[code] = result
    console.log(`${code}: ${result.count} 词 ← units → ${result.bookPath}`)
  }

  fs.writeFileSync(
    path.join(BIANPAI_REPORT_DIR, 'last-report.json'),
    `${JSON.stringify(report, null, 2)}\n`
  )
  if (!initOnly && !process.exitCode) {
    console.log('\n同步数据库: npm run tongbu:cishu -- --force ' + codes.join(' '))
  }
}

main()
