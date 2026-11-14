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
  return cleaned
    .split(/\n+|(?<=[.!?。！？])\s+/)
    .map(part => part.trim())
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
