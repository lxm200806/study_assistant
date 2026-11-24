import prisma from '../prisma/client'
import { assertBookAccess } from './book-access.service'
import { getBookByCode } from './book.service'
import { recordDailyStudy } from './daily-study.service'
import { formatBookWord, formatWordForClient } from '../utils/wordFormat'
import {
  mergeLexical,
  parseListDocument,
  partitionKnownSpellings,
  aggregateLearnerHistory,
  charsPerMinute,
  contentWords,
  parseHistoryDate,
  pickQueueIds,
  presentListMeaning,
  recentDateKeys,
  wordsForWrongBook,
  type LexicalBits,
  type ListEntry,
  type QueueCandidate,
  type RejectedToken,
  type TypingMode,
  type TypingSessionInput,
  type TypingSource
} from './typing-logic'
import { cardInputFrom, scheduleCard } from './typing-schedule'
import { practice } from './training.service'

const LIST_TEXT_LIMIT = 20000
const NAME_LIMIT = 40

export interface TypingWord {
  id: string
  word: string
  meaning: string
  phonetic: string
  englishMeaning?: string
  example?: string
  examples?: string[]
  topic?: string
  tags?: string[]
  favorite: boolean
  skipMastered: boolean
  inWrongBook: boolean
  phoneticUk?: string
  phoneticUs?: string
  synonyms?: string
  roots?: string
  etymology?: string
  phrases?: string
  note?: string
  wrongSource?: string
}

interface MarkFlags {
  favorite: boolean
  skipMastered: boolean
  inWrongBook: boolean
  wrongSource: string
}

function emptyFlags(): MarkFlags {
  return { favorite: false, skipMastered: false, inWrongBook: false, wrongSource: '' }
}

function flagsFrom(mark?: {
  favorite: boolean
  skipMastered: boolean
  inWrongBook: boolean
  wrongSource?: string
} | null): MarkFlags {
  if (!mark) return emptyFlags()
  return {
    favorite: mark.favorite,
    skipMastered: mark.skipMastered,
    inWrongBook: mark.inWrongBook,
    wrongSource: mark.inWrongBook ? (mark.wrongSource || '') : ''
  }
}

async function saveFlags(learnerId: string, wordId: string, flags: MarkFlags): Promise<MarkFlags> {
  if (!flags.favorite && !flags.skipMastered && !flags.inWrongBook) {
    await prisma.learnerWordMark.deleteMany({ where: { learnerId, wordId } })
    return flags
  }
  await prisma.learnerWordMark.upsert({
    where: { learnerId_wordId: { learnerId, wordId } },
    create: { learnerId, wordId, ...flags },
    update: flags
  })
  return flags
}

async function requireWord(wordId: string) {
  const word = await prisma.vocabulary.findUnique({ where: { id: wordId } })
  if (!word) {
    throw new Error('WORD_NOT_FOUND')
  }
  return word
}

function candidateFrom(
  id: string,
  sortOrder: number,
  stat: { practiceCount: number; due: Date | null; recentLapse: boolean } | undefined,
  mark: MarkFlags,
  now: number
): QueueCandidate {
  const dueMs = stat?.due && stat.due.getTime() <= now ? stat.due.getTime() : null
  return {
    id,
    sortOrder,
    practiced: (stat?.practiceCount ?? 0) > 0,
    dueMs,
    recentLapse: !!stat?.recentLapse,
    inWrongBook: mark.inWrongBook,
    favorite: mark.favorite,
    skipMastered: mark.skipMastered
  }
}

interface LexicalSource {
  meaning?: string | null
  ownerLearnerId?: string | null
  phoneticUk?: string | null
  phoneticUs?: string | null
  synonyms?: string | null
  roots?: string | null
  etymology?: string | null
  phrases?: string | null
}

function lexicalFrom(word?: LexicalSource | null): LexicalBits {
  return {
    phoneticUk: word?.phoneticUk || '',
    phoneticUs: word?.phoneticUs || '',
    synonyms: word?.synonyms || '',
    roots: word?.roots || '',
    etymology: word?.etymology || '',
    phrases: word?.phrases || ''
  }
}

function toTypingWord(
  formatted: ReturnType<typeof formatWordForClient>,
  flags: MarkFlags,
  word?: LexicalSource | null,
  item?: Pick<ListEntry, 'gloss' | 'phoneticUk' | 'phoneticUs' | 'synonyms' | 'roots' | 'etymology' | 'phrases'> | null
): TypingWord {
  const meaning = presentListMeaning(
    { meaning: formatted.meaning, ownerLearnerId: word?.ownerLearnerId },
    item?.gloss || ''
  )
  return {
    id: formatted.id,
    word: formatted.word,
    meaning: meaning.meaning,
    phonetic: formatted.phonetic,
    englishMeaning: formatted.englishMeaning,
    example: formatted.example,
    examples: formatted.examples,
    topic: formatted.topic,
    tags: formatted.tags,
    note: meaning.note,
    ...mergeLexical(lexicalFrom(word), item || undefined),
    ...flags
  }
}

async function overlayFromBook(bookCode: string | undefined, wordIds: string[]) {
  if (!bookCode || wordIds.length === 0) return new Map<string, ReturnType<typeof formatBookWord>>()
  const book = await getBookByCode(bookCode)
  if (!book) return new Map<string, ReturnType<typeof formatBookWord>>()
  const wanted = new Set(wordIds)
  const overlays = new Map<string, ReturnType<typeof formatBookWord>>()
  for (const link of book.vocabulary) {
    if (!wanted.has(link.wordId)) continue
    overlays.set(link.wordId, formatBookWord(link))
  }
  return overlays
}

export async function getTypingSummary(learnerId: string, bookCode: string, mode: TypingMode) {
  await assertBookAccess(learnerId, bookCode)
  const book = await getBookByCode(bookCode)
  if (!book) throw new Error('Book not found')

  const wordIds = book.vocabulary.map(link => link.wordId)
  const now = new Date()
  const [stats, marks, wrong, favorite] = await Promise.all([
    prisma.typingModeStat.findMany({
      where: { learnerId, mode, wordId: { in: wordIds } },
      select: { wordId: true, practiceCount: true, due: true, recentLapse: true }
    }),
    prisma.learnerWordMark.findMany({
      where: { learnerId, wordId: { in: wordIds } }
    }),
    prisma.learnerWordMark.count({ where: { learnerId, inWrongBook: true } }),
    prisma.learnerWordMark.count({ where: { learnerId, favorite: true } })
  ])

  const statById = new Map(stats.map(stat => [stat.wordId, stat]))
  const markById = new Map(marks.map(mark => [mark.wordId, mark]))
  let due = 0
  let unseen = 0
  let skipped = 0
  for (const id of wordIds) {
    const mark = markById.get(id)
    if (mark?.skipMastered) {
      skipped += 1
      continue
    }
    const stat = statById.get(id)
    const isDue = !!stat && (stat.recentLapse || (stat.due != null && stat.due.getTime() <= now.getTime()))
    if (isDue) due += 1
    else if (!stat || stat.practiceCount === 0) unseen += 1
  }

  return {
    bookCode,
    mode,
    bookWords: wordIds.length,
    due,
    unseen,
    skipped,
    wrong,
    favorite
  }
}

export async function getTypingQueue(
  learnerId: string,
  options: { bookCode?: string; source: TypingSource; count: number; listId?: string; mode: TypingMode }
) {
  const { source, count, mode } = options
  const bookCode = options.bookCode?.trim() || undefined
  if ((source === 'smart' || source === 'random') && !bookCode) {
    throw new Error('BOOK_REQUIRED')
  }
  if (bookCode) {
    await assertBookAccess(learnerId, bookCode)
  }

  if (source === 'smart' || source === 'random') {
    const book = await getBookByCode(bookCode!)
    if (!book) throw new Error('Book not found')
    const wordIds = book.vocabulary.map(link => link.wordId)
    const [stats, marks] = await Promise.all([
      prisma.typingModeStat.findMany({
        where: { learnerId, mode, wordId: { in: wordIds } }
      }),
      prisma.learnerWordMark.findMany({
        where: { learnerId, wordId: { in: wordIds } }
      })
    ])
    const statById = new Map(stats.map(stat => [stat.wordId, stat]))
    const markById = new Map(marks.map(mark => [mark.wordId, flagsFrom(mark)]))
    const now = Date.now()
    const candidates = book.vocabulary.map(link =>
      candidateFrom(link.wordId, link.sortOrder, statById.get(link.wordId), markById.get(link.wordId) || emptyFlags(), now)
    )
    const ids = pickQueueIds(candidates, source, count)
    const linkById = new Map(book.vocabulary.map(link => [link.wordId, link]))
    const words = ids.map(id => {
      const link = linkById.get(id)!
      return toTypingWord(formatBookWord(link), markById.get(id) || emptyFlags(), link.word)
    })
    return { source, mode, scopedToBook: true, bookCode, words, missing: [] as string[], rejected: [] as RejectedToken[] }
  }

  if (source === 'list') {
    if (!options.listId) throw new Error('LIST_REQUIRED')
    const list = await prisma.practiceList.findFirst({
      where: { id: options.listId, learnerId }
    })
    if (!list) throw new Error('NOT_FOUND')
    const materialized = await ensureListItems(learnerId, list.id, list.source)
    const ids = materialized.items.map(item => item.wordId)
    const marks = ids.length
      ? await prisma.learnerWordMark.findMany({ where: { learnerId, wordId: { in: ids } } })
      : []
    const markById = new Map(marks.map(mark => [mark.wordId, flagsFrom(mark)]))
    const overlays = await overlayFromBook(bookCode, ids)
    const candidates = materialized.items.map((item, index) =>
      candidateFrom(item.wordId, index, undefined, markById.get(item.wordId) || emptyFlags(), Date.now())
    )
    const picked = pickQueueIds(candidates, 'list', count, { listIds: ids })
    const itemById = new Map(materialized.items.map(item => [item.wordId, item]))
    const words = picked.map(id => {
      const item = itemById.get(id)!
      const overlay = overlays.get(id)
      const base = overlay || formatWordForClient(item.word)
      const lexicalWord = overlay ? { ...item.word, ownerLearnerId: null } : item.word
      return toTypingWord(base, markById.get(id) || emptyFlags(), lexicalWord, item)
    })
    return {
      source,
      mode,
      scopedToBook: false,
      bookCode: bookCode || null,
      words,
      missing: materialized.rejected.map(item => item.token),
      rejected: materialized.rejected
    }
  }

  const marks = await prisma.learnerWordMark.findMany({
    where: {
      learnerId,
      ...(source === 'wrong' ? { inWrongBook: true } : { favorite: true })
    },
    include: { word: true },
    orderBy: { updatedAt: 'desc' }
  })
  const ids = marks.map(mark => mark.wordId)
  const stats = ids.length
    ? await prisma.typingModeStat.findMany({
        where: { learnerId, mode, wordId: { in: ids } }
      })
    : []
  const statById = new Map(stats.map(stat => [stat.wordId, stat]))
  const overlays = await overlayFromBook(bookCode, ids)
  const now = Date.now()
  const candidates = marks.map((mark, index) =>
    candidateFrom(mark.wordId, index, statById.get(mark.wordId), flagsFrom(mark), now)
  )
  const picked = new Set(pickQueueIds(candidates, source, count))
  const words = marks
    .filter(mark => picked.has(mark.wordId))
    .map(mark => {
      const overlay = overlays.get(mark.wordId)
      const base = overlay || formatWordForClient(mark.word)
      return toTypingWord(base, flagsFrom(mark), mark.word)
    })
  return { source, mode, scopedToBook: false, bookCode: bookCode || null, words, missing: [] as string[], rejected: [] as RejectedToken[] }
}

export async function submitTypingAnswer(
  learnerId: string,
  wordId: string,
  isCorrect: boolean,
  mode: TypingMode
) {
  await requireWord(wordId)
  const existingStat = await prisma.typingModeStat.findUnique({
    where: { learnerId_wordId_mode: { learnerId, wordId, mode } }
  })
  const review = scheduleCard(existingStat ? cardInputFrom(existingStat) : { practiceCount: 0, correctCount: 0 }, isCorrect)
  if (existingStat) {
    await prisma.typingModeStat.update({
      where: { id: existingStat.id },
      data: review
    })
  } else {
    await prisma.typingModeStat.create({
      data: { learnerId, wordId, mode, ...review }
    })
  }
  const existing = await prisma.learnerWordMark.findUnique({
    where: { learnerId_wordId: { learnerId, wordId } }
  })
  const flags = await saveFlags(learnerId, wordId, {
    favorite: existing?.favorite ?? false,
    skipMastered: existing?.skipMastered ?? false,
    inWrongBook: !isCorrect,
    wrongSource: !isCorrect ? 'word' : ''
  })
  // 跟写、自测只记在拼读方式里。默写和听写才计入「会写」。
  if (mode === 'recall' || mode === 'dictation') {
    await practice(learnerId, { wordId, type: 'writing', isCorrect })
  }
  return { review, ...flags }
}

export async function updateTypingMark(
  learnerId: string,
  wordId: string,
  patch: { favorite?: boolean; skipMastered?: boolean }
) {
  await requireWord(wordId)
  const existing = await prisma.learnerWordMark.findUnique({
    where: { learnerId_wordId: { learnerId, wordId } }
  })
  const flags = await saveFlags(learnerId, wordId, {
    favorite: patch.favorite ?? existing?.favorite ?? false,
    skipMastered: patch.skipMastered ?? existing?.skipMastered ?? false,
    inWrongBook: existing?.inWrongBook ?? false,
    wrongSource: existing?.inWrongBook ? (existing.wrongSource || '') : ''
  })
  return { wordId, ...flags }
}

export async function markSentenceContentWrong(learnerId: string, sentence: string): Promise<string[]> {
  const tokens = contentWords(sentence)
  if (!tokens.length) return []
  const found = await prisma.vocabulary.findMany({
    where: { word: { in: tokens, mode: 'insensitive' } },
    select: { id: true, word: true }
  })
  const bySpelling = new Map(found.map(word => [word.word.toLowerCase(), word]))
  const ids = found.map(word => word.id)
  const marks = ids.length
    ? await prisma.learnerWordMark.findMany({
        where: { learnerId, wordId: { in: ids }, inWrongBook: true },
        select: { wordId: true }
      })
    : []
  const wrongIds = new Set(marks.map(mark => mark.wordId))
  const already = new Set(
    [...bySpelling.entries()].filter(([, word]) => wrongIds.has(word.id)).map(([spelling]) => spelling)
  )
  const added: string[] = []
  for (const spelling of wordsForWrongBook(sentence, new Set(bySpelling.keys()), already)) {
    const word = bySpelling.get(spelling)
    if (!word) continue
    const existing = await prisma.learnerWordMark.findUnique({
      where: { learnerId_wordId: { learnerId, wordId: word.id } }
    })
    if (existing?.inWrongBook) continue
    await prisma.learnerWordMark.upsert({
      where: { learnerId_wordId: { learnerId, wordId: word.id } },
      create: {
        learnerId,
        wordId: word.id,
        inWrongBook: true,
        wrongSource: 'sentence'
      },
      update: {
        inWrongBook: true,
        wrongSource: 'sentence'
      }
    })
    added.push(word.word)
  }
  return added
}

function clampInt(raw: unknown, max: number): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return 0
  return Math.min(max, Math.max(0, Math.floor(value)))
}

export async function recordTypingSession(
  learnerId: string,
  input: {
    date?: unknown
    durationMs?: unknown
    typedChars?: unknown
    correctChars?: unknown
    itemCount?: unknown
    correctCount?: unknown
    kind?: unknown
  }
) {
  const date = parseHistoryDate(input.date)
  const kind = input.kind === 'article' ? 'article' : input.kind === 'words' ? 'words' : ''
  const itemCount = clampInt(input.itemCount, 200)
  if (!date || !kind || itemCount <= 0) throw new Error('BAD_INPUT')
  const row = await prisma.typingSessionLog.create({
    data: {
      learnerId,
      date,
      durationMs: clampInt(input.durationMs, 2 * 60 * 60 * 1000),
      typedChars: clampInt(input.typedChars, 20000),
      correctChars: clampInt(input.correctChars, 20000),
      itemCount,
      correctCount: Math.min(itemCount, clampInt(input.correctCount, 200)),
      kind
    }
  })
  return {
    id: row.id,
    date: row.date,
    charsPerMinute: charsPerMinute(row.correctChars, row.durationMs)
  }
}

export async function getTypingHistory(learnerId: string, end: string, days: number) {
  const dates = recentDateKeys(end, days)
  const rows = await prisma.typingSessionLog.findMany({
    where: {
      learnerId,
      date: { gte: dates[0], lte: dates[dates.length - 1] }
    },
    orderBy: { createdAt: 'asc' }
  })
  const history = aggregateLearnerHistory(learnerId, rows as TypingSessionInput[], dates)
  return history
}

export async function recordTypingActivity(learnerId: string, count: number) {
  const safe = Math.min(200, Math.max(0, Math.floor(count)))
  if (safe === 0) return { recorded: 0 }
  await recordDailyStudy(learnerId, safe)
  return { recorded: safe }
}

function cleanName(value: unknown, fallback: string): string {
  const name = String(value || '').trim().slice(0, NAME_LIMIT)
  return name || fallback
}

async function fillOwnedLexical(
  word: {
    id: string
    meaning: string
    phonetic: string | null
    phoneticUk: string | null
    phoneticUs: string | null
    synonyms: string
    roots: string
    etymology: string
    phrases: string
    ownerLearnerId: string | null
  },
  entry: ListEntry
) {
  if (word.ownerLearnerId !== null && word.ownerLearnerId !== undefined) {
    const data: {
      meaning?: string
      phonetic?: string
      phoneticUk?: string
      phoneticUs?: string
      synonyms?: string
      roots?: string
      etymology?: string
      phrases?: string
    } = {}
    if (!word.meaning && entry.gloss) data.meaning = entry.gloss
    if (!word.phoneticUk && entry.phoneticUk) data.phoneticUk = entry.phoneticUk
    if (!word.phoneticUs && entry.phoneticUs) data.phoneticUs = entry.phoneticUs
    if (!word.synonyms && entry.synonyms) data.synonyms = entry.synonyms
    if (!word.roots && entry.roots) data.roots = entry.roots
    if (!word.etymology && entry.etymology) data.etymology = entry.etymology
    if (!word.phrases && entry.phrases) data.phrases = entry.phrases
    if (Object.keys(data).length === 0) return
    if (word.ownerLearnerId) {
      await prisma.vocabulary.update({ where: { id: word.id }, data })
    }
  }
}

async function resolveListEntries(learnerId: string, entries: ListEntry[]) {
  const spellings = entries.map(entry => entry.spelling)
  const found = spellings.length
    ? await prisma.vocabulary.findMany({
        where: { word: { in: spellings, mode: 'insensitive' } }
      })
    : []
  const knownIds = new Map(found.map(word => [word.word.toLowerCase(), word.id]))
  const knownById = new Map(found.map(word => [word.id, word]))
  const { linked, unknown } = partitionKnownSpellings(entries, knownIds)
  const rejected: RejectedToken[] = []
  const created: string[] = []
  const wordIds = new Map<string, string>()

  for (const entry of linked) {
    wordIds.set(entry.spelling, entry.wordId)
    const word = knownById.get(entry.wordId)
    if (word?.ownerLearnerId === learnerId) await fillOwnedLexical(word, entry)
  }

  for (const entry of unknown) {
    try {
      const word = await prisma.vocabulary.create({
        data: {
          word: entry.spelling,
          meaning: entry.gloss || '',
          phoneticUk: entry.phoneticUk || null,
          phoneticUs: entry.phoneticUs || null,
          synonyms: entry.synonyms,
          roots: entry.roots,
          etymology: entry.etymology,
          phrases: entry.phrases,
          ownerLearnerId: learnerId,
          englishMeaning: ''
        }
      })
      created.push(entry.spelling)
      wordIds.set(entry.spelling, word.id)
    } catch {
      const again = await prisma.vocabulary.findFirst({
        where: { word: { equals: entry.spelling, mode: 'insensitive' } }
      })
      if (again) wordIds.set(entry.spelling, again.id)
      else rejected.push({ token: entry.spelling, reason: 'save_failed' })
    }
  }

  const items = entries.flatMap(entry => {
    const wordId = wordIds.get(entry.spelling)
    return wordId ? [{ ...entry, wordId }] : []
  })
  return { items, linked: linked.length, created, rejected }
}

async function ensureListItems(learnerId: string, listId: string, source: string) {
  const existing = await prisma.practiceListItem.findMany({
    where: { listId },
    include: { word: true },
    orderBy: { position: 'asc' }
  })
  if (existing.length) return { items: existing, rejected: [] as RejectedToken[] }
  const parsed = parseListDocument(source)
  const resolved = await resolveListEntries(learnerId, parsed.entries)
  if (resolved.items.length) {
    await prisma.practiceListItem.createMany({
      skipDuplicates: true,
      data: resolved.items.map((item, position) => ({
        listId,
        position,
        spelling: item.spelling,
        gloss: item.gloss,
        wordId: item.wordId,
        synonyms: item.synonyms,
        roots: item.roots,
        etymology: item.etymology,
        phrases: item.phrases,
        phoneticUk: item.phoneticUk,
        phoneticUs: item.phoneticUs
      }))
    })
  }
  const items = await prisma.practiceListItem.findMany({
    where: { listId },
    include: { word: true },
    orderBy: { position: 'asc' }
  })
  return { items, rejected: [...parsed.rejected, ...resolved.rejected] }
}

export async function listPracticeLists(learnerId: string) {
  const rows = await prisma.practiceList.findMany({
    where: { learnerId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { items: true } } }
  })
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    count: row._count.items || parseListDocument(row.source).entries.length,
    createdAt: row.createdAt
  }))
}

export async function createPracticeList(learnerId: string, name: unknown, text: unknown) {
  const source = String(text || '').trim()
  if (!source || source.length > LIST_TEXT_LIMIT) throw new Error('BAD_INPUT')
  const parsed = parseListDocument(source)
  if (!parsed.entries.length) {
    const error = new Error('BAD_INPUT') as Error & { rejected?: RejectedToken[] }
    error.rejected = parsed.rejected
    throw error
  }
  const resolved = await resolveListEntries(learnerId, parsed.entries)
  const rejected = [...parsed.rejected, ...resolved.rejected]
  if (!resolved.items.length) {
    const error = new Error('BAD_INPUT') as Error & { rejected?: RejectedToken[] }
    error.rejected = rejected
    throw error
  }
  const row = await prisma.practiceList.create({
    data: {
      learnerId,
      name: cleanName(name, '我的词表'),
      source,
      items: {
        create: resolved.items.map((item, position) => ({
          position,
          spelling: item.spelling,
          gloss: item.gloss,
          wordId: item.wordId,
          synonyms: item.synonyms,
          roots: item.roots,
          etymology: item.etymology,
          phrases: item.phrases,
          phoneticUk: item.phoneticUk,
          phoneticUs: item.phoneticUs
        }))
      }
    }
  })
  return {
    id: row.id,
    name: row.name,
    count: resolved.items.length,
    linked: resolved.linked,
    created: resolved.created,
    matched: resolved.linked,
    missing: resolved.rejected.map(item => item.token),
    rejected
  }
}

export async function deletePracticeList(learnerId: string, id: string) {
  const row = await prisma.practiceList.findFirst({ where: { id, learnerId } })
  if (!row) throw new Error('NOT_FOUND')
  await prisma.practiceList.delete({ where: { id } })
}
