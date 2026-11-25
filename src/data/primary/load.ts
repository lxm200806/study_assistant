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

type LocalTextbookOverlay = { bookCode?: string; passages?: PepPassage[] }

const bookModules = import.meta.glob('./*.json', {
  import: 'default'
}) as Record<string, () => Promise<PepBook>>

const localTextbookModules = import.meta.glob('./local/*-textbook.json', {
  import: 'default'
}) as Record<string, () => Promise<LocalTextbookOverlay>>

function applyLocalTextbookOverlay(book: PepBook, overlay: LocalTextbookOverlay | null): PepBook {
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

const CATALOG_BOOKS = new Map(
  (catalog.books as PepCatalogBook[]).map(book => [book.code, book])
)
const bookCache = new Map<string, PepBook | null>()
const pendingBooks = new Map<string, Promise<PepBook | null>>()

export function listPepBooks(): PepCatalogBook[] {
  return (catalog.books as PepCatalogBook[]).map(b => ({
    ...b,
    series: b.series || 'pep',
    seriesLabel: b.seriesLabel || '人教 PEP',
    grade: b.grade || '',
    term: b.term || ''
  }))
}

export function hasPepBook(code: string): boolean {
  return CATALOG_BOOKS.has(code)
}

export function getLoadedPepBook(code: string): PepBook | null {
  return bookCache.get(code) || null
}

export async function loadPepBook(code: string): Promise<PepBook | null> {
  if (bookCache.has(code)) return bookCache.get(code) || null
  const inFlight = pendingBooks.get(code)
  if (inFlight) return inFlight

  const meta = CATALOG_BOOKS.get(code)
  const loader = bookModules[`./${code}.json`]
  if (!meta || !loader) {
    bookCache.set(code, null)
    return null
  }

  const task = (async () => {
    const raw = await loader()
    const overlayLoader = localTextbookModules[`./local/${code}-textbook.json`]
    const overlay = overlayLoader ? await overlayLoader() : null
    const book = applyLocalTextbookOverlay(
      {
        ...raw,
        code: raw.code || meta.code,
        name: raw.name || meta.name,
        level: raw.level || meta.level,
        shortLabel: raw.shortLabel || meta.shortLabel,
        year: raw.year ?? meta.year,
        series: raw.series || meta.series,
        seriesLabel: raw.seriesLabel || meta.seriesLabel,
        grade: raw.grade || meta.grade,
        term: raw.term || meta.term
      },
      overlay
    )
    bookCache.set(code, book)
    return book
  })()

  pendingBooks.set(code, task)
  try {
    return await task
  } finally {
    pendingBooks.delete(code)
  }
}

export async function loadPepUnit(code: string, unitId: string): Promise<PepUnit | null> {
  const book = await loadPepBook(code)
  if (!book) return null
  return book.units.find(u => u.id === unitId) || null
}
