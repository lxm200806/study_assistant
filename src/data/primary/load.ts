import catalog from './catalog.json'

export type PepPassage = {
  key: string
  title: string
  source: string
  body: string
  translation: string
  kind?: string
  ready?: boolean
}

export type PepUnit = {
  id: string
  title: string
  theme: string
  words: Array<{ word: string; phonetic: string; meaning: string }>
  authoredPassages: PepPassage[]
  textbookPassages: PepPassage[]
  passages: PepPassage[]
}

export type PepBook = {
  code: string
  name: string
  level: string
  shortLabel?: string
  year?: number
  series?: string
  seriesLabel?: string
  grade?: string
  term?: string
  units: PepUnit[]
}

export type PepCatalogBook = {
  code: string
  name: string
  level: string
  shortLabel: string
  series: string
  seriesLabel: string
  grade: string
  term: string
  year: number
  wordCount: number
  unitCount: number
}

const bookModules = import.meta.glob('./*.json', {
  eager: true,
  import: 'default'
}) as Record<string, PepBook>

const localTextbookModules = import.meta.glob('./local/*-textbook.json', {
  eager: true,
  import: 'default'
}) as Record<string, { bookCode?: string; passages?: PepPassage[] }>

function applyLocalTextbookOverlay(book: PepBook): PepBook {
  const entry = Object.entries(localTextbookModules).find(([file]) =>
    file.includes(`${book.code}-textbook.json`)
  )
  const overlay = entry?.[1]
  if (!overlay?.passages?.length) return book

  const byKey = new Map(
    overlay.passages.filter(p => p?.key && (p.body || '').trim()).map(p => [p.key, p])
  )
  if (!byKey.size) return book

  return {
    ...book,
    units: book.units.map(unit => ({
      ...unit,
      textbookPassages: (unit.textbookPassages || []).map(slot => {
        const hit = byKey.get(slot.key)
        if (!hit) return slot
        return {
          ...slot,
          title: hit.title || slot.title,
          source: hit.source || slot.source,
          body: hit.body,
          translation: hit.translation || '',
          kind: 'textbook',
          ready: true
        }
      })
    }))
  }
}

function loadBookModule(code: string): PepBook | null {
  const entry = Object.entries(bookModules).find(([file]) => {
    if (file.includes('catalog.json')) return false
    if (file.includes('/local/')) return false
    return file.endsWith(`/${code}.json`) || file.endsWith(`${code}.json`)
  })
  return entry?.[1] || null
}

const BOOKS_WITH_LOCAL: Record<string, PepBook> = {}
for (const item of catalog.books as PepCatalogBook[]) {
  const raw = loadBookModule(item.code)
  if (!raw) continue
  BOOKS_WITH_LOCAL[item.code] = applyLocalTextbookOverlay({
    ...raw,
    code: raw.code || item.code,
    name: raw.name || item.name,
    level: raw.level || item.level,
    shortLabel: raw.shortLabel || item.shortLabel,
    year: raw.year ?? item.year,
    series: raw.series || item.series,
    seriesLabel: raw.seriesLabel || item.seriesLabel,
    grade: raw.grade || item.grade,
    term: raw.term || item.term
  })
}

export function listPepBooks(): PepCatalogBook[] {
  return (catalog.books as PepCatalogBook[]).map(b => ({
    ...b,
    series: b.series || 'pep',
    seriesLabel: b.seriesLabel || '人教 PEP',
    grade: b.grade || '',
    term: b.term || ''
  }))
}

export function getPepBook(code: string): PepBook | null {
  return BOOKS_WITH_LOCAL[code] || null
}

export function getPepUnit(code: string, unitId: string): PepUnit | null {
  const book = getPepBook(code)
  if (!book) return null
  return book.units.find(u => u.id === unitId) || null
}
