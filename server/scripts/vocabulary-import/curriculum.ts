/**
 * 统一课表原料：每本书一份 units.json。
 * 路径：data/vocabulary/units/<code>.json
 */
import fs from 'fs'
import path from 'path'
import { VOCABULARY_BOOK_CODES } from '../../src/data/vocabulary'
import type { WordData } from '../../src/data/vocabulary/types'
import { BOOKS_DIR, SERVER_ROOT, TMP_DIR } from './book-lexicon-paths'
import { flattenKewBook, type KewBookSource, type KewCatalog, type KewUnit } from './parse-kew'

export const UNITS_DIR = path.join(SERVER_ROOT, 'data/vocabulary/units')
export const BIANPAI_REPORT_DIR = path.join(TMP_DIR, 'bianpai')

export interface SenseOverride {
  senseKey: string
  senseLabel?: string
}

export interface CurriculumBook extends KewBookSource {
  listSource?: string
  source?: string
  senseOverrides?: Record<string, SenseOverride>
}

export function unitsPath(code: string): string {
  return path.join(UNITS_DIR, `${code}.json`)
}

export function bookJsonPath(code: string): string {
  return path.join(BOOKS_DIR, `${code}.json`)
}

export function defaultListSource(code: string): string {
  const map: Record<string, string> = {
    kew1200: 'kew-toc',
    kew4500: 'kew4500-word-lists',
    kew7200: 'kew7200-toc',
    'mse-ket': 'cambridge-mse',
    'mse-pet': 'cambridge-mse',
    zhongkao: 'kylebing-junior',
    gaokao: 'kylebing-senior',
    cet4: 'cnexam-cet4',
    cet6: 'cnexam-cet6',
    'pep-g3a-2024': 'pep-primary-ss-aihu',
    'pep-g3b-2025': 'pep-primary-ss-aihu',
    'pep-g4a-2025': 'pep-primary-ss-aihu',
    'pep-g4b-2026': 'pep-primary-ss-aihu',
    'pep-g5a-2026': 'pep-primary-ss-aihu',
    'pep-g4b-legacy': 'kb-md',
    'pep-g5a-legacy': 'kb-md',
    'pep-g5b-legacy': 'kb-md',
    'pep-g6a-legacy': 'kb-md',
    'pep-g6b-legacy': 'kb-md',
    'jt-g3a-2024': 'kb-md',
    'jt-g3b-2025': 'kb-md',
    'jt-g4a-2025': 'kb-md',
    'jt-g4b': 'kb-md',
    'jt-g5a': 'kb-md',
    'jt-g5b': 'kb-md',
    'jt-g6a': 'kb-md',
    'jt-g6b': 'kb-md'
  }
  return map[code] || code
}

export function loadCurriculumBook(code: string): CurriculumBook {
  const file = unitsPath(code)
  if (!fs.existsSync(file)) {
    throw new Error(`缺少单元表: ${file}（先 --init 或手写 units，再 cishu:bianpai）`)
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as CurriculumBook | KewCatalog
  if ('books' in raw && Array.isArray((raw as KewCatalog).books)) {
    const catalog = raw as KewCatalog
    const hit = catalog.books.find(b => b.code === code) || catalog.books[0]
    if (!hit) throw new Error(`${file} 中没有书 ${code}`)
    return {
      ...hit,
      source: catalog.source,
      listSource: defaultListSource(code)
    }
  }
  const book = raw as CurriculumBook
  if (!book.code) book.code = code
  if (!book.listSource) book.listSource = defaultListSource(code)
  return book
}

export function resolveBookCodes(argv: string[]): string[] {
  const args = argv.filter(a => !a.startsWith('--') && !a.endsWith('.ts') && !/[\\/]/.test(a))
  if (!args.length) return [...VOCABULARY_BOOK_CODES]
  return args
}

export function curriculumToSlimWords(book: CurriculumBook): WordData[] {
  const { words } = flattenKewBook(book)
  const list = book.listSource || defaultListSource(book.code)
  const overrides = book.senseOverrides || {}
  return words.map(w => {
    const o = overrides[w.word]
    const senseKey = o?.senseKey || w.senseKey
    const senseLabel = o?.senseLabel || w.senseLabel
    const tags = [...w.tags.filter(t => !t.startsWith('src:list=') && !t.startsWith('sense:')), `src:list=${list}`]
    if (senseKey) tags.push(`sense:${senseKey}`)
    const row: WordData = { word: w.word, tags }
    if (senseKey) row.senseKey = senseKey
    if (senseLabel) row.senseLabel = senseLabel
    return row
  })
}

function unitIdFromTags(tags: string[] | undefined): string | null {
  const hit = (tags || []).find(
    t => t.startsWith('kew-unit:') || t.startsWith('unit:') || t.startsWith('lesson:')
  )
  if (!hit) return null
  return hit.slice(hit.indexOf(':') + 1)
}

/** 从现有成品课表导出单元表 */
export function bookJsonToCurriculum(code: string, opts: { unitSize?: number } = {}): CurriculumBook {
  const unitSize = opts.unitSize ?? 20
  const file = bookJsonPath(code)
  if (!fs.existsSync(file)) throw new Error(`缺少成品书: ${file}`)
  const book = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    code?: string
    name?: string
    description?: string
    level?: string
    targetWordCount?: number
    source?: string
    words: WordData[]
  }

  const words = book.words || []
  const hasUnitTags = words.some(w => unitIdFromTags(w.tags))
  const units: KewUnit[] = []
  const senseOverrides: Record<string, SenseOverride> = {}

  if (hasUnitTags) {
    const order: string[] = []
    const map = new Map<string, string[]>()
    for (const item of words) {
      const word = item.word.trim().toLowerCase()
      if (!word) continue
      const id = unitIdFromTags(item.tags) || 'u1'
      if (!map.has(id)) {
        map.set(id, [])
        order.push(id)
      }
      const list = map.get(id)!
      if (!list.includes(word)) list.push(word)
      if (item.senseKey) {
        senseOverrides[word] = { senseKey: item.senseKey, senseLabel: item.senseLabel }
      }
    }
    for (const id of order) {
      units.push({ id, title: `Unit ${id}`, words: map.get(id)! })
    }
  } else {
    for (let i = 0; i < words.length; i += unitSize) {
      const chunk = words.slice(i, i + unitSize)
      const id = `u${Math.floor(i / unitSize) + 1}`
      const list: string[] = []
      for (const item of chunk) {
        const word = item.word.trim().toLowerCase()
        if (!word || list.includes(word)) continue
        list.push(word)
        if (item.senseKey) {
          senseOverrides[word] = { senseKey: item.senseKey, senseLabel: item.senseLabel }
        }
      }
      units.push({ id, title: `Unit ${Math.floor(i / unitSize) + 1}`, words: list })
    }
  }

  const out: CurriculumBook = {
    code: book.code || code,
    name: book.name || code,
    description: book.description || '',
    level: book.level || '',
    targetWordCount: book.targetWordCount || words.length,
    source: book.source,
    listSource: defaultListSource(code),
    units
  }
  if (Object.keys(senseOverrides).length) out.senseOverrides = senseOverrides
  return out
}

export function saveCurriculumBook(book: CurriculumBook) {
  fs.mkdirSync(UNITS_DIR, { recursive: true })
  const file = unitsPath(book.code)
  fs.writeFileSync(file, `${JSON.stringify(book, null, 2)}\n`)
  return file
}

export { VOCABULARY_BOOK_CODES }
