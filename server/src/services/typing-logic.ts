export type TypingSource = 'smart' | 'wrong' | 'favorite' | 'random' | 'list'

export interface QueueCandidate {
  id: string
  sortOrder: number
  practiced: boolean
  /** Due timestamp when the writing card is already due; otherwise null. */
  dueMs: number | null
  recentLapse: boolean
  inWrongBook: boolean
  favorite: boolean
  skipMastered: boolean
}

const WORD_TOKEN = /^[a-z][a-z0-9'’-]{0,48}$/i

export function parseWordTokens(text: string, limit = 400): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[\s,;，；、]+/)) {
    const token = raw.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '')
    if (!WORD_TOKEN.test(token)) continue
    const key = token.toLowerCase().replace(/’/g, "'")
    if (seen.has(key)) continue
    seen.add(key)
    out.push(key)
    if (out.length >= limit) break
  }
  return out
}

export function splitPieces(text: string, limit = 200): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').trim()
  if (!cleaned) return []
  const protectedText = cleaned.replace(/\b(Mr|Mrs|Ms|Dr|St|Prof)\./g, '$1\u0000')
  return protectedText
    .split(/\n+|(?<=[.!?。！？])\s+/)
    .map(part => part.replace(/\u0000/g, '.').trim())
    .filter(Boolean)
    .slice(0, limit)
}

export function splitSentences(text: string, limit = 200): string[] {
  return splitPieces(text, limit).filter(part => /[A-Za-z]/.test(part)).slice(0, limit)
}

export function normalizeTyped(text: string): string {
  return text
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function answersMatch(expected: string, typed: string, kind: 'word' | 'sentence'): boolean {
  if (kind === 'word') {
    const strip = (value: string) => normalizeTyped(value).replace(/[^a-z0-9' -]/g, '')
    return strip(expected) === strip(typed) && strip(expected).length > 0
  }
  const left = normalizeTyped(expected)
  return left.length > 0 && left === normalizeTyped(typed)
}

export type LiveKind = 'ok' | 'bad' | 'pending' | 'extra'

export function liveMarks(expected: string, typed: string): Array<{ ch: string; kind: LiveKind }> {
  const exp = [...expected]
  const got = [...typed]
  const marks: Array<{ ch: string; kind: LiveKind }> = exp.map((ch, index) => {
    if (index >= got.length) return { ch, kind: 'pending' as const }
    const same = ch.toLowerCase() === got[index].toLowerCase()
    return { ch, kind: same ? 'ok' as const : 'bad' as const }
  })
  if (got.length > exp.length) {
    for (const ch of got.slice(exp.length)) marks.push({ ch, kind: 'extra' })
  }
  return marks
}

function byOrder(a: QueueCandidate, b: QueueCandidate): number {
  return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
}

function byDueThenOrder(a: QueueCandidate, b: QueueCandidate): number {
  const dueA = a.dueMs ?? Number.MAX_SAFE_INTEGER
  const dueB = b.dueMs ?? Number.MAX_SAFE_INTEGER
  return dueA - dueB || byOrder(a, b)
}

function takeIds(rows: QueueCandidate[], count: number): string[] {
  return rows.slice(0, count).map(row => row.id)
}

export function pickQueueIds(
  candidates: QueueCandidate[],
  source: TypingSource,
  count: number,
  options?: { listIds?: string[]; random?: () => number }
): string[] {
  const limit = Math.max(0, Math.floor(count))
  if (limit === 0) return []

  if (source === 'wrong') {
    return takeIds(candidates.filter(row => row.inWrongBook).sort(byOrder), limit)
  }
  if (source === 'favorite') {
    return takeIds(candidates.filter(row => row.favorite).sort(byOrder), limit)
  }
  if (source === 'list') {
    const byId = new Map(candidates.map(row => [row.id, row]))
    const ids: string[] = []
    for (const id of options?.listIds || []) {
      const row = byId.get(id)
      if (!row || row.skipMastered) continue
      ids.push(id)
      if (ids.length >= limit) break
    }
    return ids
  }

  const pool = candidates.filter(row => !row.skipMastered)
  if (source === 'random') {
    const copy = [...pool]
    const random = options?.random ?? Math.random
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      const swap = copy[i]
      copy[i] = copy[j]
      copy[j] = swap
    }
    return takeIds(copy, limit)
  }

  const lapses = pool.filter(row => row.recentLapse).sort(byDueThenOrder)
  const due = pool.filter(row => !row.recentLapse && row.dueMs != null).sort(byDueThenOrder)
  const fresh = pool.filter(row => !row.practiced && !row.recentLapse && row.dueMs == null).sort(byOrder)
  const rest = pool.filter(row => row.practiced && !row.recentLapse && row.dueMs == null).sort(byOrder)
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of [...lapses, ...due, ...fresh, ...rest]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row.id)
    if (out.length >= limit) break
  }
  return out
}

export function clampCount(raw: unknown, fallback = 20): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return Math.min(50, Math.max(1, Math.floor(value)))
}

export function parseTypingSource(raw: unknown): TypingSource | null {
  if (raw === 'smart' || raw === 'wrong' || raw === 'favorite' || raw === 'random' || raw === 'list') {
    return raw
  }
  return null
}

export type TypingMode = 'follow' | 'dictation' | 'self' | 'recall'

export function parseTypingMode(raw: unknown, fallback: TypingMode = 'follow'): TypingMode | null {
  if (raw === undefined || raw === null || raw === '') return fallback
  if (raw === 'follow' || raw === 'dictation' || raw === 'self' || raw === 'recall') return raw
  return null
}

export type RejectReason = 'not_english' | 'too_long' | 'empty' | 'limit' | 'save_failed'

export const REJECT_TEXT: Record<RejectReason, string> = {
  not_english: '不是可用的英文拼写',
  too_long: '超过长度限制',
  empty: '是空的',
  limit: '超过一次可导入的数量',
  save_failed: '没能写入词库'
}

export interface RejectedToken {
  token: string
  reason: RejectReason
}

export interface ListEntry {
  spelling: string
  gloss: string
  synonyms: string
  roots: string
  etymology: string
  phrases: string
  phoneticUk: string
  phoneticUs: string
}

export interface LexicalBits {
  phoneticUk: string
  phoneticUs: string
  synonyms: string
  roots: string
  etymology: string
  phrases: string
}

const SPELLING = /^[a-z][a-z0-9'’-]{0,48}$/i
const EXTRA_LABEL: Record<string, keyof ListEntry> = {
  syn: 'synonyms',
  synonym: 'synonyms',
  synonyms: 'synonyms',
  root: 'roots',
  roots: 'roots',
  ety: 'etymology',
  etymology: 'etymology',
  phrase: 'phrases',
  phrases: 'phrases',
  uk: 'phoneticUk',
  us: 'phoneticUs'
}

function blankEntry(spelling: string): ListEntry {
  return {
    spelling,
    gloss: '',
    synonyms: '',
    roots: '',
    etymology: '',
    phrases: '',
    phoneticUk: '',
    phoneticUs: ''
  }
}

function normalizeSpelling(raw: string): { spelling: string } | { reject: RejectReason; token: string } {
  const token = raw.trim().slice(0, 80)
  if (!token) return { reject: 'empty', token: '' }
  const stripped = token.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '')
  if (!stripped) return { reject: 'not_english', token }
  if (stripped.length > 49) return { reject: 'too_long', token: stripped.slice(0, 80) }
  if (!SPELLING.test(stripped)) return { reject: 'not_english', token: stripped.slice(0, 80) }
  return { spelling: stripped.toLowerCase().replace(/’/g, "'") }
}

function applyExtra(entry: ListEntry, segment: string) {
  const piece = segment.trim()
  if (!piece) return
  const labeled = piece.match(/^([A-Za-z]+)\s*:\s*(.+)$/)
  if (labeled) {
    const field = EXTRA_LABEL[labeled[1].toLowerCase()]
    if (field && field !== 'spelling') {
      entry[field] = labeled[2].trim().slice(0, field === 'phoneticUk' || field === 'phoneticUs' ? 80 : 300)
      return
    }
  }
  const gloss = piece.slice(0, 200)
  entry.gloss = entry.gloss ? `${entry.gloss}；${gloss}`.slice(0, 200) : gloss
}

export function parseListDocument(
  text: string,
  limit = 400
): { entries: ListEntry[]; rejected: RejectedToken[] } {
  const entries: ListEntry[] = []
  const rejected: RejectedToken[] = []
  const seen = new Set<string>()

  const pushSpelling = (raw: string, extras: string[]) => {
    const parsed = normalizeSpelling(raw)
    if ('reject' in parsed) {
      if (parsed.reject !== 'empty' && parsed.token) rejected.push({ token: parsed.token, reason: parsed.reject })
      return
    }
    if (seen.has(parsed.spelling)) return
    if (entries.length >= limit) {
      rejected.push({ token: parsed.spelling, reason: 'limit' })
      return
    }
    seen.add(parsed.spelling)
    const entry = blankEntry(parsed.spelling)
    for (const extra of extras) applyExtra(entry, extra)
    entries.push(entry)
  }

  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.includes('|') || trimmed.includes('\t')) {
      const parts = trimmed.split(/\||\t/).map(part => part.trim())
      pushSpelling(parts[0] || '', parts.slice(1))
      continue
    }
    for (const chunk of trimmed.split(/[\s,;，；、]+/)) {
      if (chunk) pushSpelling(chunk, [])
    }
  }

  return { entries, rejected }
}

export function partitionKnownSpellings<T extends { spelling: string }>(
  entries: T[],
  knownIds: Map<string, string>
): { linked: Array<T & { wordId: string }>; unknown: T[] } {
  const linked: Array<T & { wordId: string }> = []
  const unknown: T[] = []
  for (const entry of entries) {
    const wordId = knownIds.get(entry.spelling)
    if (wordId) linked.push({ ...entry, wordId })
    else unknown.push(entry)
  }
  return { linked, unknown }
}

export function presentListMeaning(
  word: { meaning: string; ownerLearnerId?: string | null },
  gloss: string
): { meaning: string; note: string } {
  const noteGloss = gloss.trim()
  if (!noteGloss) return { meaning: word.meaning, note: '' }
  if (word.ownerLearnerId || !word.meaning.trim()) {
    return { meaning: noteGloss, note: '' }
  }
  if (noteGloss === word.meaning.trim()) return { meaning: word.meaning, note: '' }
  return { meaning: word.meaning, note: noteGloss }
}

export function mergeLexical(base: Partial<LexicalBits>, extra?: Partial<LexicalBits>): LexicalBits {
  const pick = (key: keyof LexicalBits) => (extra?.[key] || '').trim() || (base[key] || '').trim()
  return {
    phoneticUk: pick('phoneticUk'),
    phoneticUs: pick('phoneticUs'),
    synonyms: pick('synonyms'),
    roots: pick('roots'),
    etymology: pick('etymology'),
    phrases: pick('phrases')
  }
}

export interface DueSentence {
  articleKey: string
  sentenceIndex: number
  practiceCount: number
  due: Date | null
  recentLapse: boolean
}

export function sentenceIsDue(
  card: Pick<DueSentence, 'practiceCount' | 'due' | 'recentLapse'>,
  now: number
): boolean {
  if (card.practiceCount <= 0) return false
  if (card.recentLapse) return true
  return card.due != null && card.due.getTime() <= now
}

export function pickDueSentences<T extends DueSentence>(cards: T[], now: number, limit: number): T[] {
  const cap = Math.max(0, Math.floor(limit))
  return cards
    .filter(card => sentenceIsDue(card, now))
    .sort((a, b) => {
      const dueA = a.due?.getTime() ?? 0
      const dueB = b.due?.getTime() ?? 0
      return dueA - dueB || a.articleKey.localeCompare(b.articleKey) || a.sentenceIndex - b.sentenceIndex
    })
    .slice(0, cap)
}

export function articleKeyFor(id: string): { key: string; builtinKey: string | null; userId: string | null } {
  if (id.startsWith('builtin:')) {
    const builtinKey = id.slice('builtin:'.length)
    return { key: id, builtinKey, userId: null }
  }
  const userId = id.startsWith('user:') ? id.slice('user:'.length) : id
  return { key: `user:${userId}`, builtinKey: null, userId }
}

export interface SentenceDraft {
  text: string
  translation: string
}

export interface SentenceEditPlan<T extends { sentenceIndex: number; text: string }> {
  kept: Array<{ card: T; sentenceIndex: number; translation: string }>
  reset: Array<SentenceDraft & { sentenceIndex: number }>
  retired: T[]
}

/** Match sentences by exact text so an unchanged line keeps its card, even if it moves. */
export function planSentenceEdit<T extends { sentenceIndex: number; text: string }>(
  existing: T[],
  next: SentenceDraft[]
): SentenceEditPlan<T> {
  const unused = [...existing].sort((a, b) => a.sentenceIndex - b.sentenceIndex)
  const kept: SentenceEditPlan<T>['kept'] = []
  const reset: SentenceEditPlan<T>['reset'] = []
  for (let sentenceIndex = 0; sentenceIndex < next.length; sentenceIndex++) {
    const sentence = next[sentenceIndex]
    const matchAt = unused.findIndex(card => card.text === sentence.text)
    if (matchAt >= 0) {
      const [card] = unused.splice(matchAt, 1)
      kept.push({ card, sentenceIndex, translation: sentence.translation })
    } else {
      reset.push({ sentenceIndex, text: sentence.text, translation: sentence.translation })
    }
  }
  return { kept, reset, retired: unused }
}

const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'so', 'as', 'at', 'by', 'for', 'from',
  'in', 'into', 'of', 'on', 'onto', 'off', 'out', 'over', 'to', 'up', 'down', 'with', 'without',
  'about', 'after', 'before', 'between', 'through', 'during', 'under', 'again', 'further', 'once',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'doing',
  'have', 'has', 'had', 'having', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'ours', 'theirs',
  'this', 'that', 'these', 'those', 'there', 'here', 'what', 'which', 'who', 'whom', 'whose',
  'when', 'where', 'why', 'how', 'not', 'no', 'nor', 'very', 'just', 'also', 'too'
])

export function contentWords(sentence: string): string[] {
  return parseWordTokens(sentence, 80).filter(token => !FUNCTION_WORDS.has(token))
}

/** Spellings to add to the wrong-word book. Unknown tokens and words already listed are left out. */
export function wordsForWrongBook(sentence: string, known: Set<string>, alreadyWrong: Set<string>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const token of contentWords(sentence)) {
    if (seen.has(token) || !known.has(token) || alreadyWrong.has(token)) continue
    seen.add(token)
    out.push(token)
  }
  return out
}

export interface TypingSessionInput {
  learnerId: string
  date: string
  durationMs: number
  typedChars: number
  correctChars: number
  itemCount: number
  correctCount: number
  createdAt: string | Date
}

const MIN_SPEED_MS = 3000

export function parseHistoryDate(raw: unknown): string | null {
  const value = String(raw || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return value
}

export function recentDateKeys(end: string, count: number): string[] {
  const [year, month, day] = end.split('-').map(Number)
  const cursor = new Date(Date.UTC(year, month - 1, day))
  const dates: string[] = []
  const total = Math.max(1, Math.floor(count))
  for (let offset = total - 1; offset >= 0; offset--) {
    const next = new Date(cursor)
    next.setUTCDate(cursor.getUTCDate() - offset)
    dates.push(next.toISOString().slice(0, 10))
  }
  return dates
}

export function charsPerMinute(correctChars: number, durationMs: number): number {
  if (durationMs < MIN_SPEED_MS || correctChars <= 0) return 0
  return Math.round(correctChars / (durationMs / 60000))
}

export function heatLevel(items: number): 0 | 1 | 2 | 3 | 4 {
  if (items <= 0) return 0
  if (items < 5) return 1
  if (items < 15) return 2
  if (items < 30) return 3
  return 4
}

export function aggregateLearnerHistory(learnerId: string, rows: TypingSessionInput[], dates: string[]) {
  const mine = rows.filter(row => row.learnerId === learnerId)
  const byDate = new Map<string, { items: number; durationMs: number; correctChars: number }>()
  for (const row of mine) {
    const bucket = byDate.get(row.date) || { items: 0, durationMs: 0, correctChars: 0 }
    bucket.items += row.itemCount
    bucket.durationMs += row.durationMs
    bucket.correctChars += row.correctChars
    byDate.set(row.date, bucket)
  }
  const allowed = new Set(dates)
  return {
    days: dates.map(date => {
      const bucket = byDate.get(date) || { items: 0, durationMs: 0, correctChars: 0 }
      return {
        date,
        items: bucket.items,
        minutes: Math.round(bucket.durationMs / 60000),
        charsPerMinute: charsPerMinute(bucket.correctChars, bucket.durationMs),
        level: heatLevel(bucket.items)
      }
    }),
    speed: mine
      .filter(row => allowed.has(row.date))
      .map(row => ({
        at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        charsPerMinute: charsPerMinute(row.correctChars, row.durationMs),
        items: row.itemCount
      }))
      .filter(point => point.charsPerMinute > 0)
      .slice(-20)
  }
}
