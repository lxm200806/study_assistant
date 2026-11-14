import prisma from '../prisma/client'
import { assertBookAccess } from './book-access.service'
import { getBookByCode } from './book.service'
import { practice } from './training.service'
import { recordDailyStudy } from './daily-study.service'
import { formatBookWord, formatWordForClient } from '../utils/wordFormat'
import {
  parseWordTokens,
  pickQueueIds,
  splitPieces,
  splitSentences,
  type QueueCandidate,
  type TypingSource
} from './typing-logic'

const LIST_TEXT_LIMIT = 20000
const ARTICLE_TEXT_LIMIT = 8000
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
}

interface MarkFlags {
  favorite: boolean
  skipMastered: boolean
  inWrongBook: boolean
}

function emptyFlags(): MarkFlags {
  return { favorite: false, skipMastered: false, inWrongBook: false }
}

function flagsFrom(mark?: {
  favorite: boolean
  skipMastered: boolean
  inWrongBook: boolean
} | null): MarkFlags {
  if (!mark) return emptyFlags()
  return {
    favorite: mark.favorite,
    skipMastered: mark.skipMastered,
    inWrongBook: mark.inWrongBook
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

function toTypingWord(
  formatted: ReturnType<typeof formatWordForClient>,
  flags: MarkFlags
): TypingWord {
  return {
    id: formatted.id,
    word: formatted.word,
    meaning: formatted.meaning,
    phonetic: formatted.phonetic,
    englishMeaning: formatted.englishMeaning,
    example: formatted.example,
    examples: formatted.examples,
    topic: formatted.topic,
    tags: formatted.tags,
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

export async function getTypingSummary(learnerId: string, bookCode: string) {
  await assertBookAccess(learnerId, bookCode)
  const book = await getBookByCode(bookCode)
  if (!book) throw new Error('Book not found')

  const wordIds = book.vocabulary.map(link => link.wordId)
  const now = new Date()
  const [stats, marks, wrong, favorite] = await Promise.all([
    prisma.vocabularyStat.findMany({
      where: { learnerId, type: 'writing', wordId: { in: wordIds } },
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
  options: { bookCode?: string; source: TypingSource; count: number; listId?: string }
) {
  const { source, count } = options
  const bookCode = options.bookCode?.trim() || undefined
  if ((source === 'smart' || source === 'random') && !bookCode) {
    throw new Error('BOOK_REQUIRED')
  }
  if (bookCode && (source === 'smart' || source === 'random')) {
    await assertBookAccess(learnerId, bookCode)
  }

  if (source === 'smart' || source === 'random') {
    const book = await getBookByCode(bookCode!)
    if (!book) throw new Error('Book not found')
    const wordIds = book.vocabulary.map(link => link.wordId)
    const [stats, marks] = await Promise.all([
      prisma.vocabularyStat.findMany({
        where: { learnerId, type: 'writing', wordId: { in: wordIds } }
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
      return toTypingWord(formatBookWord(link), markById.get(id) || emptyFlags())
    })
    return { source, scopedToBook: true, bookCode, words, missing: [] as string[] }
  }

  if (source === 'list') {
    if (!options.listId) throw new Error('LIST_REQUIRED')
    const list = await prisma.practiceList.findFirst({
      where: { id: options.listId, learnerId }
    })
    if (!list) throw new Error('NOT_FOUND')
    const tokens = parseWordTokens(list.source)
    const found = tokens.length
      ? await prisma.vocabulary.findMany({
          where: { word: { in: tokens, mode: 'insensitive' } }
        })
      : []
    const bySpelling = new Map(found.map(word => [word.word.toLowerCase(), word]))
    const ordered = tokens.map(token => bySpelling.get(token)).filter((word): word is NonNullable<typeof word> => !!word)
    const missing = tokens.filter(token => !bySpelling.has(token))
    const ids = ordered.map(word => word.id)
    const marks = ids.length
      ? await prisma.learnerWordMark.findMany({ where: { learnerId, wordId: { in: ids } } })
      : []
    const markById = new Map(marks.map(mark => [mark.wordId, flagsFrom(mark)]))
    const overlays = await overlayFromBook(bookCode, ids)
    const candidates = ordered.map((word, index) =>
      candidateFrom(word.id, index, undefined, markById.get(word.id) || emptyFlags(), Date.now())
    )
    const picked = pickQueueIds(candidates, 'list', count, { listIds: ids })
    const wordById = new Map(ordered.map(word => [word.id, word]))
    const words = picked.map(id => {
      const overlay = overlays.get(id)
      const base = overlay || formatWordForClient(wordById.get(id)!)
      return toTypingWord(base, markById.get(id) || emptyFlags())
    })
    return { source, scopedToBook: false, bookCode: bookCode || null, words, missing }
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
    ? await prisma.vocabularyStat.findMany({
        where: { learnerId, type: 'writing', wordId: { in: ids } }
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
      return toTypingWord(base, flagsFrom(mark))
    })
  return { source, scopedToBook: false, bookCode: bookCode || null, words, missing: [] as string[] }
}

export async function submitTypingAnswer(learnerId: string, wordId: string, isCorrect: boolean) {
  await requireWord(wordId)
  const review = await practice(learnerId, { wordId, type: 'writing', isCorrect })
  const existing = await prisma.learnerWordMark.findUnique({
    where: { learnerId_wordId: { learnerId, wordId } }
  })
  const flags = await saveFlags(learnerId, wordId, {
    favorite: existing?.favorite ?? false,
    skipMastered: existing?.skipMastered ?? false,
    inWrongBook: !isCorrect
  })
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
    inWrongBook: existing?.inWrongBook ?? false
  })
  return { wordId, ...flags }
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

export async function listPracticeLists(learnerId: string) {
  const rows = await prisma.practiceList.findMany({
    where: { learnerId },
    orderBy: { updatedAt: 'desc' }
  })
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    count: parseWordTokens(row.source).length,
    createdAt: row.createdAt
  }))
}

export async function createPracticeList(learnerId: string, name: unknown, text: unknown) {
  const source = String(text || '').trim()
  if (!source || source.length > LIST_TEXT_LIMIT) throw new Error('BAD_INPUT')
  const tokens = parseWordTokens(source)
  if (!tokens.length) throw new Error('BAD_INPUT')
  const found = await prisma.vocabulary.findMany({
    where: { word: { in: tokens, mode: 'insensitive' } },
    select: { word: true }
  })
  const known = new Set(found.map(word => word.word.toLowerCase()))
  const missing = tokens.filter(token => !known.has(token))
  const row = await prisma.practiceList.create({
    data: {
      learnerId,
      name: cleanName(name, '我的词表'),
      source: tokens.join('\n')
    }
  })
  return {
    id: row.id,
    name: row.name,
    count: tokens.length,
    matched: tokens.length - missing.length,
    missing
  }
}

export async function deletePracticeList(learnerId: string, id: string) {
  const row = await prisma.practiceList.findFirst({ where: { id, learnerId } })
  if (!row) throw new Error('NOT_FOUND')
  await prisma.practiceList.delete({ where: { id } })
}

export async function listPracticeArticles(learnerId: string) {
  const rows = await prisma.practiceArticle.findMany({
    where: { learnerId },
    orderBy: { updatedAt: 'desc' }
  })
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    sentenceCount: splitSentences(row.body).length,
    createdAt: row.createdAt
  }))
}

export async function createPracticeArticle(
  learnerId: string,
  input: { title?: unknown; body?: unknown; translation?: unknown }
) {
  const body = String(input.body || '').trim()
  const translation = String(input.translation || '').trim()
  if (!body || body.length > ARTICLE_TEXT_LIMIT || translation.length > ARTICLE_TEXT_LIMIT) {
    throw new Error('BAD_INPUT')
  }
  const sentences = splitSentences(body)
  if (!sentences.length) throw new Error('BAD_INPUT')
  const row = await prisma.practiceArticle.create({
    data: {
      learnerId,
      title: cleanName(input.title, sentences[0].slice(0, NAME_LIMIT)),
      body,
      translation
    }
  })
  return { id: row.id, title: row.title, sentenceCount: sentences.length }
}

export async function getPracticeArticle(learnerId: string, id: string) {
  const row = await prisma.practiceArticle.findFirst({ where: { id, learnerId } })
  if (!row) throw new Error('NOT_FOUND')
  const sentences = splitSentences(row.body)
  const translated = row.translation ? splitPieces(row.translation) : []
  const paired = translated.length === sentences.length ? translated : []
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    translation: row.translation,
    sentences: sentences.map((text, index) => ({
      text,
      translation: paired[index] || ''
    }))
  }
}

export async function deletePracticeArticle(learnerId: string, id: string) {
  const row = await prisma.practiceArticle.findFirst({ where: { id, learnerId } })
  if (!row) throw new Error('NOT_FOUND')
  await prisma.practiceArticle.delete({ where: { id } })
}
