/**
 * 从 server/data/kb/md 同步全部课本：
 * - units（新书；preserveUnits 的新教材不覆盖）
 * - textbook 槽位 + *.local.json + primary/local overlay
 * - src/data/primary/<code>.json + catalog.json
 *
 * Usage: npm run kb:import
 */
import fs from 'fs'
import path from 'path'
import { KB_BOOKS, type KbBookMeta } from './book-map'

const ROOT = path.resolve(__dirname, '../..')
const MD_ROOT = path.join(ROOT, 'data/kb/md')
const UNITS_DIR = path.join(ROOT, 'data/vocabulary/units')
const PASSAGES_DIR = path.join(ROOT, 'data/vocabulary/passages')
const GLOSSES_DIR = path.join(ROOT, 'data/sources/pep')
const PRIMARY_DIR = path.join(ROOT, '../src/data/primary')
const PRIMARY_LOCAL = path.join(PRIMARY_DIR, 'local')

type VocabItem = { word: string; meaning: string }
type Passage = {
  key: string
  bookCode: string
  unitId: string
  kind: 'textbook' | 'authored'
  title: string
  source: string
  body: string
  translation: string
  ready?: boolean
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
}

function section(md: string, heading: string): string {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, 'm')
  const m = md.match(re)
  if (!m || m.index === undefined) return ''
  const start = m.index + m[0].length
  const rest = md.slice(start)
  const next = rest.search(/^##\s+/m)
  return (next < 0 ? rest : rest.slice(0, next)).trim()
}

const STOP_WORDS = new Set(
  `
  a an the and or but to of in on at for with from by as into onto over under
  is am are was were be been being do does did doing done have has had having
  i you he she it we they my your his her its our their me him them
  this that these those what who where when how why which yes no not
  can could will would shall should may might must please here there
  ok oh ah uh um er well so too also just very really quite
  hi hello goodbye bye thanks thank okay right now then than
  mr mrs miss ms dad mum mom
  `.split(/\s+/).filter(Boolean)
)

function parseVocab(block: string): VocabItem[] {
  const out: VocabItem[] = []
  const seen = new Set<string>()
  for (const raw of block.split(/\n+/)) {
    const line = raw.trim()
    if (!line.startsWith('- ')) continue
    if (/未抽出|未找到|暂无/.test(line)) continue
    const body = line.slice(2).trim()
    const parts = body.split(/\s+[—–]\s+/)
    let word = (parts[0] || '').trim()
    const meaning = parts.slice(1).join(' — ').trim()
    word = word.replace(/\s+/g, ' ').replace(/[.;,]+$/g, '').trim()
    if (!word || word.length > 40) continue
    // skip pure Chinese / exercise junk
    if (!/[A-Za-z]/.test(word)) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ word, meaning })
  }
  return out
}

/** 词汇表未抽出时，从常用表达法 + 课文对话抽词（过滤虚词） */
function deriveVocabFromContent(md: string): VocabItem[] {
  const out: VocabItem[] = []
  const seen = new Set<string>()

  const pushWord = (raw: string, meaning = '') => {
    let word = raw.replace(/\s+/g, ' ').replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, '').trim()
    if (!word || word.length > 32) return
    if (!/^[A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){0,3}$/.test(word)) return
    const key = word.toLowerCase()
    if (STOP_WORDS.has(key)) return
    if (seen.has(key)) return
    // skip likely names (single Capitalized token in dialogue speakers already stripped)
    if (/^[A-Z][a-z]+$/.test(word) && word.length <= 3) return
    seen.add(key)
    out.push({ word: key, meaning })
  }

  for (const row of parseExprLines(section(md, '常用表达法'))) {
    // multi-word useful chunks as phrases if short
    const en = row.en.replace(/^[A-Za-z][A-Za-z .]*:\s*/, '')
    for (const m of en.matchAll(/\b[A-Za-z][A-Za-z'-]{1,24}\b/g)) {
      pushWord(m[0], '')
    }
  }

  for (const lesson of parseDialogueLessons(section(md, '课文对话'))) {
    for (const line of lesson.lines) {
      const text = line.replace(/^[A-Za-z][A-Za-z .]*:\s*/, '')
      for (const m of text.matchAll(/\b[A-Za-z][A-Za-z'-]{1,24}\b/g)) {
        pushWord(m[0], '')
      }
    }
  }

  return out
}

function unitVocab(md: string): VocabItem[] {
  const fromTable = parseVocab(section(md, '词汇表'))
  if (fromTable.length) return fromTable
  return deriveVocabFromContent(md)
}

function parseExprLines(block: string): Array<{ en: string; zh: string }> {
  const out: Array<{ en: string; zh: string }> = []
  for (const raw of block.split(/\n+/)) {
    const line = raw.trim()
    if (!line.startsWith('- ')) continue
    if (/未找到|未抽出|暂无/.test(line)) continue
    const body = line.slice(2).trim()
    const parts = body.split(/\s+[—–-]\s+/)
    if (parts.length >= 2) out.push({ en: parts[0].trim(), zh: parts.slice(1).join(' — ').trim() })
    else if (body) out.push({ en: body, zh: '' })
  }
  return out
}

function parseDialogueLessons(block: string): Array<{ title: string; lines: string[] }> {
  if (!block.trim()) return []
  const lessons: Array<{ title: string; lines: string[] }> = []
  let cur: { title: string; lines: string[] } | null = null
  for (const raw of block.split(/\n/)) {
    const line = raw.trimEnd()
    const h3 = line.match(/^###\s+(.+)/)
    if (h3) {
      cur = { title: h3[1].trim(), lines: [] }
      lessons.push(cur)
      continue
    }
    const bullet = line.match(/^-\s+(.+)/)
    if (bullet && !/未找到|未抽出/.test(bullet[1])) {
      if (!cur) {
        cur = { title: 'Dialogue', lines: [] }
        lessons.push(cur)
      }
      cur.lines.push(bullet[1].trim())
    }
  }
  return lessons.filter(l => l.lines.length > 0)
}

function unitNumFromFile(name: string): number | null {
  const m = name.match(/^unit-(\d+)/i)
  return m ? Number(m[1]) : null
}

function titleFromMd(md: string, file: string, n: number): string {
  const h1 = md.match(/^#\s+(.+)/m)?.[1]?.trim() || ''
  const bad =
    !h1 ||
    h1.length > 60 ||
    /^contents$/i.test(h1) ||
    /^unit\s+\d+\s+contents$/i.test(h1) ||
    /thinking tasks/i.test(h1) ||
    !/^unit\s+\d+/i.test(h1)
  if (!bad) return h1.replace(/[‘’]/g, "'")
  const slug = file.replace(/^unit-\d+-/, '').replace(/\.md$/, '').replace(/-/g, ' ')
  const pretty = slug.replace(/\b\w/g, c => c.toUpperCase())
  return `Unit ${n} ${pretty}`.trim()
}

function listUnitFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter(f => /^unit-\d+/i.test(f) && f.endsWith('.md'))
    .sort((a, b) => (unitNumFromFile(a) || 0) - (unitNumFromFile(b) || 0))
}

function ensureTextbookSlots(meta: KbBookMeta, unitIds: string[], titles: Record<string, string>) {
  const file = path.join(PASSAGES_DIR, `${meta.code}-textbook.json`)
  const passages: Passage[] = []
  for (const id of unitIds) {
    const title = titles[id] || id
    for (const part of ['a', 'b'] as const) {
      passages.push({
        key: `${meta.code}-${id}-textbook-${part}`,
        bookCode: meta.code,
        unitId: id,
        kind: 'textbook',
        title: `${title} · Part ${part.toUpperCase()}`,
        source: '教材原文（待授权填入）',
        body: '',
        translation: '',
        ready: false
      })
    }
  }
  writeJson(file, {
    bookCode: meta.code,
    kind: 'textbook',
    note: '教材原文槽位；授权正文写入 *.local.json',
    passages
  })
  return passages
}

function fillPassages(
  meta: KbBookMeta,
  unitId: string,
  unitTitle: string,
  md: string,
  slots: Passage[]
): Passage[] {
  const unitSlots = slots.filter(p => p.unitId === unitId)
  if (!unitSlots.length) return []
  const dialogue = parseDialogueLessons(section(md, '课文对话'))
  const exprs = parseExprLines(section(md, '常用表达法'))
  const source = '个人课本库（本地授权填入）'
  const filled = unitSlots.map(s => ({ ...s, body: '', translation: '', ready: false }))

  if (dialogue.length) {
    const a = dialogue[0]
    const b = dialogue.slice(1)
    filled[0] = {
      ...filled[0],
      title: `${unitTitle} · ${a.title}`,
      source,
      body: a.lines.join('\n'),
      translation: '',
      ready: true
    }
    if (filled[1] && b.length) {
      filled[1] = {
        ...filled[1],
        title: `${unitTitle} · ${b.map(x => x.title).join(' / ')}`,
        source,
        body: b.flatMap(lesson => [`【${lesson.title}】`, ...lesson.lines]).join('\n'),
        translation: '',
        ready: true
      }
    }
    return filled.filter(p => p.body.trim())
  }

  if (exprs.length) {
    const mid = Math.ceil(exprs.length / 2) || exprs.length
    const chunks = [exprs.slice(0, mid), exprs.slice(mid)].filter(c => c.length)
    chunks.forEach((chunk, i) => {
      if (!filled[i]) return
      filled[i] = {
        ...filled[i],
        title: `${unitTitle} · 常用表达法${chunks.length > 1 ? ` ${i === 0 ? 'A' : 'B'}` : ''}`,
        source,
        body: chunk.map(x => x.en).join('\n'),
        translation: chunk.map(x => x.zh).join('\n'),
        ready: true
      }
    })
    return filled.filter(p => p.body.trim())
  }
  return []
}

function loadExistingUnits(code: string): {
  units: Array<{ id: string; title: string; theme?: string; words: string[] }>
} | null {
  const file = path.join(UNITS_DIR, `${code}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function buildUnitsFromMd(meta: KbBookMeta, dir: string) {
  const unitFiles = listUnitFiles(dir)
  const units: Array<{ id: string; title: string; theme: string; words: string[] }> = []
  const glosses: Record<string, string> = {}
  const titles: Record<string, string> = {}

  for (const file of unitFiles) {
    const n = unitNumFromFile(file)
    if (!n) continue
    const id = `u${n}`
    const md = fs.readFileSync(path.join(dir, file), 'utf-8')
    const title = titleFromMd(md, file, n)
    titles[id] = title
    const vocab = unitVocab(md)
    for (const v of vocab) {
      if (v.meaning && !glosses[v.word.toLowerCase()]) glosses[v.word.toLowerCase()] = v.meaning
    }
    units.push({
      id,
      title,
      theme: '',
      words: vocab.map(v => v.word)
    })
  }

  const wordCount = units.reduce((n, u) => n + u.words.length, 0)
  writeJson(path.join(UNITS_DIR, `${meta.code}.json`), {
    code: meta.code,
    name: meta.name,
    description: `${meta.name}。词表/课文整理自个人课本 Markdown（kb/md）。`,
    level: meta.level,
    targetWordCount: wordCount || units.length * 10,
    source: `${meta.code}-kb-md`,
    listSource: 'kb-md',
    units
  })

  if (Object.keys(glosses).length) {
    writeJson(path.join(GLOSSES_DIR, `${meta.code}-glosses.json`), {
      bookCode: meta.code,
      glosses
    })
  }

  return { units, titles, glosses, wordCount }
}

function buildPrimaryBook(
  meta: KbBookMeta,
  units: Array<{ id: string; title: string; theme?: string; words: string[] }>,
  glosses: Record<string, string>,
  localByKey: Map<string, Passage>
) {
  const primaryUnits = units.map(u => {
    const slots = ['a', 'b'].map(part => {
      const key = `${meta.code}-${u.id}-textbook-${part}`
      const hit = localByKey.get(key)
      return {
        key,
        title: hit?.title || `${u.title} · Part ${part.toUpperCase()}`,
        source: hit?.source || '教材原文（待授权填入）',
        body: hit?.body || '',
        translation: hit?.translation || '',
        kind: 'textbook' as const,
        ready: !!(hit?.body || '').trim()
      }
    })
    return {
      id: u.id,
      title: u.title,
      theme: u.theme || '',
      words: (u.words || []).map(word => ({
        word,
        phonetic: '',
        meaning: glosses[word.toLowerCase()] || ''
      })),
      authoredPassages: [] as Passage[],
      textbookPassages: slots,
      passages: [] as Passage[]
    }
  })

  writeJson(path.join(PRIMARY_DIR, `${meta.code}.json`), {
    code: meta.code,
    name: meta.name,
    level: meta.level,
    shortLabel: meta.shortLabel,
    year: meta.year,
    series: meta.series,
    seriesLabel: meta.seriesLabel,
    grade: meta.grade,
    term: meta.term,
    units: primaryUnits
  })

  return {
    wordCount: primaryUnits.reduce((n, u) => n + u.words.length, 0),
    unitCount: primaryUnits.length
  }
}

function importOne(meta: KbBookMeta) {
  const dir = meta.rel ? path.join(MD_ROOT, meta.rel) : ''
  const hasMd = !!(meta.rel && fs.existsSync(dir) && listUnitFiles(dir).length)

  let units: Array<{ id: string; title: string; theme?: string; words: string[] }>
  let titles: Record<string, string> = {}
  let glosses: Record<string, string> = {}

  if (meta.preserveUnits) {
    const existing = loadExistingUnits(meta.code)
    if (!existing?.units?.length) {
      if (!hasMd) {
        console.warn(`跳过（无 units 无 md）: ${meta.code}`)
        return null
      }
      const built = buildUnitsFromMd(meta, dir)
      units = built.units
      titles = built.titles
      glosses = built.glosses
    } else {
      units = existing.units
      titles = Object.fromEntries(units.map(u => [u.id, u.title]))
      const glossFile = path.join(GLOSSES_DIR, `${meta.code}-glosses.json`)
      if (fs.existsSync(glossFile)) {
        glosses = (JSON.parse(fs.readFileSync(glossFile, 'utf-8')) as { glosses?: Record<string, string> })
          .glosses || {}
      }
    }
  } else {
    if (!hasMd) {
      console.warn(`跳过（无 md）: ${meta.code}`)
      return null
    }
    const built = buildUnitsFromMd(meta, dir)
    units = built.units
    titles = built.titles
    glosses = built.glosses
  }

  const unitIds = units.map(u => u.id)
  const slots = ensureTextbookSlots(meta, unitIds, titles)

  const localPassages: Passage[] = []
  if (hasMd) {
    for (const file of listUnitFiles(dir)) {
      const n = unitNumFromFile(file)
      if (!n) continue
      const unitId = `u${n}`
      const md = fs.readFileSync(path.join(dir, file), 'utf-8')
      const unitTitle = titles[unitId] || titleFromMd(md, file, n)
      localPassages.push(...fillPassages(meta, unitId, unitTitle, md, slots))
    }
  }

  writeJson(path.join(PASSAGES_DIR, `${meta.code}-textbook.local.json`), {
    bookCode: meta.code,
    kind: 'textbook',
    note: '由 server/data/kb/md 导入；gitignore，勿提交',
    passages: localPassages
  })
  writeJson(path.join(PRIMARY_LOCAL, `${meta.code}-textbook.json`), {
    bookCode: meta.code,
    passages: localPassages.map(p => ({
      key: p.key,
      title: p.title,
      source: p.source,
      body: p.body,
      translation: p.translation,
      kind: 'textbook',
      ready: true
    }))
  })

  const localByKey = new Map(localPassages.map(p => [p.key, p]))
  const primaryFile = path.join(PRIMARY_DIR, `${meta.code}.json`)
  let stats: { wordCount: number; unitCount: number }
  if (meta.preserveUnits && fs.existsSync(primaryFile)) {
    // 保留已有自编课文与音标，只叠加 local 原文
    const existing = JSON.parse(fs.readFileSync(primaryFile, 'utf-8')) as {
      units?: Array<{ words?: unknown[] }>
    }
    stats = {
      unitCount: existing.units?.length || units.length,
      wordCount: (existing.units || []).reduce((n, u) => n + (u.words?.length || 0), 0)
    }
  } else {
    stats = buildPrimaryBook(meta, units, glosses, localByKey)
  }
  console.log(
    `${meta.code}: units=${stats.unitCount} words=${stats.wordCount} textbook=${localPassages.length}`
  )
  return { ...meta, ...stats }
}

function writeCatalog(
  rows: Array<KbBookMeta & { wordCount: number; unitCount: number }>
) {
  writeJson(path.join(PRIMARY_DIR, 'catalog.json'), {
    books: rows.map(r => ({
      code: r.code,
      name: r.name,
      level: r.level,
      shortLabel: r.shortLabel,
      series: r.series,
      seriesLabel: r.seriesLabel,
      grade: r.grade,
      term: r.term,
      year: r.year,
      wordCount: r.wordCount,
      unitCount: r.unitCount
    }))
  })
}

function main() {
  if (!fs.existsSync(MD_ROOT)) {
    console.error(`缺少 ${MD_ROOT}，先 npm run kb:sync`)
    process.exit(1)
  }
  fs.mkdirSync(PRIMARY_LOCAL, { recursive: true })
  fs.mkdirSync(UNITS_DIR, { recursive: true })
  fs.mkdirSync(PASSAGES_DIR, { recursive: true })
  fs.mkdirSync(GLOSSES_DIR, { recursive: true })

  const catalogRows: Array<KbBookMeta & { wordCount: number; unitCount: number }> = []
  for (const meta of KB_BOOKS) {
    const row = importOne(meta)
    if (row) catalogRows.push(row)
  }
  writeCatalog(catalogRows)
  console.log(`catalog: ${catalogRows.length} 册`)
}

main()
