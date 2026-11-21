/**
 * 词书 ↔ 全局词典差异：导出增量 / 合并进总表。
 *
 * 导出（只写 tmp，不改 senses.json）：
 *   npm run cishu:daochu
 *   npm run cishu:daochu -- kew1200
 *
 * 合并（从 delta 写入总表；缺词 pending，已有只补洞）：
 *   npm run cidian:hebing -- --from tmp/lexicon-from-books/kew1200/delta.jsonl
 *   npm run cidian:hebing -- --book kew1200          # 读该次导出目录
 *   npm run cidian:hebing -- --book kew1200 --dry-run
 */
import fs from 'fs'
import path from 'path'
import {
  asFlatSense,
  buildSenseFromFlat,
  clearSensesCache,
  isLexiconSettled,
  loadGlobalSenses,
  saveGlobalSenses,
  sensesFilePath,
  type FlatSenseView,
  type GlobalSense
} from '../../src/data/vocabulary/senses'
import type { WordData } from '../../src/data/vocabulary/types'
import { BOOKS_DIR, TMP_DIR, VOCABULARY_BOOK_CODES_HINT } from './book-lexicon-paths'

export type DeltaReason = 'missing' | 'fill'

export type BookFlatFields = {
  meaning?: string
  englishMeaning?: string
  phonetic?: string
  exampleSentence?: string
  exampleSentenceZh?: string
  examExample?: string
  examExampleZh?: string
  topic?: string
  cefr?: string
  contentType?: string
  senseKey?: string
  senseLabel?: string
  unitTags?: string[]
}

export type DeltaRow = {
  word: string
  fromBook: string
  reason: DeltaReason
  fields: BookFlatFields
  fillKeys?: string[]
  index?: number
}

export type UnresolvedRow = {
  word: string
  fromBook: string
  reason: 'conflict'
  conflicts: Array<{ key: string; book: string; lexicon: string }>
  fields: BookFlatFields
  lexiconStatus?: string
  index?: number
}

const CONTENT_KEYS = [
  'meaning',
  'englishMeaning',
  'phonetic',
  'exampleSentence',
  'exampleSentenceZh',
  'examExample',
  'examExampleZh',
  'topic',
  'cefr',
  'contentType'
] as const

type ContentKey = (typeof CONTENT_KEYS)[number]

function norm(s: string | undefined): string {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function pickBookFields(w: WordData): BookFlatFields {
  const basic = (w.examples || []).find(e => e.role === 'basic')
  const exam = (w.examples || []).find(e => e.role === 'exam' || e.role === 'sense')
  const unitTags = (w.tags || []).filter(
    t => t.startsWith('kew-unit:') || t.startsWith('unit:') || t.startsWith('lesson:')
  )
  const fields: BookFlatFields = {}
  if (w.meaning?.trim()) fields.meaning = w.meaning.trim()
  if (w.englishMeaning?.trim()) fields.englishMeaning = w.englishMeaning.trim()
  if (w.phonetic?.trim()) fields.phonetic = w.phonetic.trim()
  const ex = (w.exampleSentence || basic?.en || '').trim()
  if (ex) fields.exampleSentence = ex
  const exZh = (basic?.zh || '').trim()
  if (exZh) fields.exampleSentenceZh = exZh
  const examEn = (exam?.en || '').trim()
  if (examEn) fields.examExample = examEn
  const examZh = (exam?.zh || '').trim()
  if (examZh) fields.examExampleZh = examZh
  if (w.topic) fields.topic = String(w.topic)
  if (w.cefr) fields.cefr = String(w.cefr)
  if (w.contentType) fields.contentType = String(w.contentType)
  if (w.senseKey?.trim()) fields.senseKey = w.senseKey.trim()
  if (w.senseLabel?.trim()) fields.senseLabel = w.senseLabel.trim()
  if (unitTags.length) fields.unitTags = unitTags
  return fields
}

function lexiconValue(flat: FlatSenseView, key: ContentKey): string {
  const map: Record<ContentKey, string | undefined> = {
    meaning: flat.meaning,
    englishMeaning: flat.englishMeaning,
    phonetic: flat.phonetic,
    exampleSentence: flat.exampleSentence,
    exampleSentenceZh: flat.exampleSentenceZh,
    examExample: flat.examExample,
    examExampleZh: flat.examExampleZh,
    topic: flat.topic,
    cefr: flat.cefr,
    contentType: flat.contentType
  }
  return map[key] || ''
}

export function compareBookWordToLexicon(
  bookCode: string,
  word: WordData,
  index: number,
  lexicon: Record<string, GlobalSense>
): { delta?: DeltaRow; unresolved?: UnresolvedRow; skip?: true } {
  const key = word.word.trim().toLowerCase()
  if (!key) return { skip: true }
  const fields = pickBookFields(word)
  const entry = lexicon[key]

  if (!entry) {
    return {
      delta: {
        word: key,
        fromBook: bookCode,
        reason: 'missing',
        fields,
        index
      }
    }
  }

  const flat = asFlatSense(entry)
  const fillKeys: string[] = []
  const fillFields: BookFlatFields = {
    senseKey: fields.senseKey,
    senseLabel: fields.senseLabel,
    unitTags: fields.unitTags
  }
  const conflicts: Array<{ key: string; book: string; lexicon: string }> = []

  for (const k of CONTENT_KEYS) {
    const bookVal = fields[k] || ''
    const lexVal = lexiconValue(flat, k)
    if (!norm(bookVal)) continue
    if (!norm(lexVal)) {
      fillKeys.push(k)
      ;(fillFields as any)[k] = bookVal
      continue
    }
    if (norm(bookVal) !== norm(lexVal)) {
      conflicts.push({ key: k, book: bookVal, lexicon: lexVal })
    }
  }

  const out: { delta?: DeltaRow; unresolved?: UnresolvedRow; skip?: true } = {}
  if (conflicts.length) {
    out.unresolved = {
      word: key,
      fromBook: bookCode,
      reason: 'conflict',
      conflicts,
      fields,
      lexiconStatus: entry.status,
      index
    }
  }
  if (fillKeys.length) {
    out.delta = {
      word: key,
      fromBook: bookCode,
      reason: 'fill',
      fields: fillFields,
      fillKeys,
      index
    }
  }
  if (!out.delta && !out.unresolved) out.skip = true
  return out
}

export function loadBookWords(code: string): WordData[] {
  const file = path.join(BOOKS_DIR, `${code}.json`)
  if (!fs.existsSync(file)) throw new Error(`缺少成品书: ${file}`)
  const book = JSON.parse(fs.readFileSync(file, 'utf-8')) as { words?: WordData[] }
  return book.words || []
}

export function bookExportDir(bookCode: string): string {
  return path.join(TMP_DIR, 'lexicon-from-books', bookCode)
}

export function exportBookDelta(bookCode: string) {
  clearSensesCache()
  const lexicon = loadGlobalSenses()
  const words = loadBookWords(bookCode)
  const deltas: DeltaRow[] = []
  const unresolved: UnresolvedRow[] = []
  let same = 0

  words.forEach((w, index) => {
    const r = compareBookWordToLexicon(bookCode, w, index, lexicon)
    if (r.delta) deltas.push(r.delta)
    if (r.unresolved) unresolved.push(r.unresolved)
    if (!r.delta && !r.unresolved) same += 1
  })

  const outDir = bookExportDir(bookCode)
  fs.mkdirSync(outDir, { recursive: true })
  const deltaPath = path.join(outDir, 'delta.jsonl')
  const unresolvedPath = path.join(outDir, 'unresolved.json')
  const reportPath = path.join(outDir, 'report.json')

  fs.writeFileSync(deltaPath, deltas.map(d => JSON.stringify(d)).join('\n') + (deltas.length ? '\n' : ''))
  fs.writeFileSync(unresolvedPath, `${JSON.stringify(unresolved, null, 2)}\n`)
  const report = {
    book: bookCode,
    at: new Date().toISOString(),
    totalWords: words.length,
    sameOrCovered: same,
    delta: deltas.length,
    missing: deltas.filter(d => d.reason === 'missing').length,
    fill: deltas.filter(d => d.reason === 'fill').length,
    unresolved: unresolved.length,
    deltaPath,
    unresolvedPath
  }
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  return report
}

/** 只补空字段，绝不重建 meanings（避免多义项被压成一条） */
function applyFillToEntry(entry: GlobalSense, fields: BookFlatFields): GlobalSense {
  const next: GlobalSense = {
    ...entry,
    meanings: entry.meanings.map(m => ({
      ...m,
      meaning: { ...m.meaning },
      sentences: m.sentences.map(s => ({ ...s }))
    })),
    phonetic: entry.phonetic ? { ...entry.phonetic } : undefined
  }

  if (!next.contentType && fields.contentType) next.contentType = fields.contentType
  if (!next.topic && fields.topic) next.topic = fields.topic
  if (!next.level && fields.cefr) next.level = fields.cefr

  const ph = next.phonetic
  const hasPh = !!(ph && (ph.g || ph.uk || ph.us))
  if (!hasPh && fields.phonetic) {
    next.phonetic = { g: fields.phonetic }
  }

  const m0 = next.meanings[0]
  if (m0) {
    if (!m0.meaning.zh?.trim() && fields.meaning) m0.meaning.zh = fields.meaning
    if (!m0.meaning.en?.trim() && fields.englishMeaning) m0.meaning.en = fields.englishMeaning

    const hasBasic = m0.sentences.some(s => s.role === 'basic' && s.en.trim())
    if (!hasBasic && fields.exampleSentence) {
      m0.sentences.unshift({
        en: fields.exampleSentence,
        role: 'basic',
        ...(fields.exampleSentenceZh ? { zh: fields.exampleSentenceZh } : {})
      })
    } else if (fields.exampleSentenceZh) {
      const basic = m0.sentences.find(s => s.role === 'basic' && s.en.trim())
      if (basic && !basic.zh?.trim()) basic.zh = fields.exampleSentenceZh
    }

    const hasExt = m0.sentences.some(s => s.role === 'ext' && s.en.trim())
    if (!hasExt && fields.examExample) {
      m0.sentences.push({
        en: fields.examExample,
        role: 'ext',
        ...(fields.examExampleZh ? { zh: fields.examExampleZh } : {})
      })
    } else if (fields.examExampleZh) {
      const ext = m0.sentences.find(s => s.role === 'ext' && s.en.trim())
      if (ext && !ext.zh?.trim()) ext.zh = fields.examExampleZh
    }
  }

  return next
}

export function mergeDeltaFile(
  deltaPath: string,
  opts: { dryRun?: boolean } = {}
): {
  added: number
  filled: number
  skipped: number
  dryRun: boolean
} {
  if (!fs.existsSync(deltaPath)) throw new Error(`找不到 delta: ${deltaPath}`)
  clearSensesCache()
  const lexicon = loadGlobalSenses()
  const lines = fs
    .readFileSync(deltaPath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  let added = 0
  let filled = 0
  let skipped = 0

  for (const line of lines) {
    const row = JSON.parse(line) as DeltaRow
    const word = row.word.trim().toLowerCase()
    if (!word) {
      skipped += 1
      continue
    }
    const existing = lexicon[word]

    if (row.reason === 'missing' || !existing) {
      if (!existing) {
        lexicon[word] = buildSenseFromFlat({
          ...row.fields,
          status: 'pending',
          origin: `book:${row.fromBook}`
        })
        added += 1
      } else {
        // delta 说 missing 但现在已有：改补洞
        const before = JSON.stringify(asFlatSense(existing))
        lexicon[word] = applyFillToEntry(existing, row.fields)
        if (JSON.stringify(asFlatSense(lexicon[word])) !== before) filled += 1
        else skipped += 1
      }
      continue
    }

    if (row.reason === 'fill') {
      // settled 也只补空字段
      const before = JSON.stringify(asFlatSense(existing))
      lexicon[word] = applyFillToEntry(existing, row.fields)
      // 补洞后若曾是 pending 保持；llm/verified 保持
      if (isLexiconSettled(existing)) {
        lexicon[word] = { ...lexicon[word], status: existing.status, origin: existing.origin }
      }
      if (JSON.stringify(asFlatSense(lexicon[word])) !== before) filled += 1
      else skipped += 1
      continue
    }

    skipped += 1
  }

  if (!opts.dryRun && (added > 0 || filled > 0)) {
    saveGlobalSenses(lexicon)
  }

  return { added, filled, skipped, dryRun: !!opts.dryRun }
}

export { VOCABULARY_BOOK_CODES_HINT, sensesFilePath }
