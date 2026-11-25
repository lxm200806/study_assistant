import prisma from '../prisma/client'
import { getBookByCode } from './book.service'
import {
  aggregateWordMastery,
  aggregateBookWordStats,
  getMasteryStatus,
  buildTypeStatsFromEntry,
  type WordStatEntry
} from './mastery-aggregate.service'
import { getContentTypeLabel, TOPIC_CATEGORIES } from '../data/taxonomy'
import type { ContentType, TopicCategory } from '../data/vocabulary/types'

/* ═══════════════════════════════════════════
 *  Type Definitions
 * ═══════════════════════════════════════════ */

export interface MapWordEntry {
  wordId: string
  word: string
  meaning: string
  phonetic?: string | null
  phoneticUk?: string | null
  phoneticUs?: string | null
  contentType: ContentType | null
  topic: TopicCategory | null
  tags: string[]
  mastery: number
  status: string
  recognize: number | null
  write: number | null
  skillLabel: string
  lastPractice: string | null
  byType: Record<string, number>
  typeStats?: {
    practiceCount: number
    correctCount: number
    mastery: number
    accuracy: number
    due: string | null
    retrievability: number
    reps: number
    lapses: number
    fsrsState: string
    weakReason?: 'overdue' | 'low_retention' | 'recent_lapse'
  }
}

export interface CategoryStats {
  type: ContentType
  label: string
  mastered: number
  learning: number
  weak: number
  unpracticed: number
  avgMastery: number
  wordCount: number
}

export interface TopicStats {
  topic: TopicCategory
  label: string
  avgMastery: number
  weakCount: number
  wordCount: number
  mastered: number
}

/** Book-level stats for a single word within the global map context */
export interface WordBookGroup {
  bookCode: string
  bookName: string
  mastery: number
  practiced: boolean
  practiceCount: number
}

/** Extended word entry for global map (includes multi-book grouping) */
export interface GroupedMapWordEntry extends MapWordEntry {
  groups?: WordBookGroup[]
}

/* ─── Helpers ─── */

async function loadStatsMap(userId: string, wordIds: string[]): Promise<Map<string, WordStatEntry[]>> {
  const map = new Map<string, WordStatEntry[]>()
  if (!wordIds.length) return map
  const stats = await prisma.vocabularyStat.findMany({
    where: { learnerId: userId, wordId: { in: wordIds } }
  })
  for (const stat of stats) {
    const list = map.get(stat.wordId) || []
    list.push(statToWordEntry(stat))
    map.set(stat.wordId, list)
  }
  return map
}

function statToWordEntry(stat: any): WordStatEntry {
  return {
    wordId: stat.wordId,
    type: stat.type as WordStatEntry['type'],
    practiceCount: stat.practiceCount,
    correctCount: stat.correctCount,
    mastery: stat.mastery,
    lastPractice: stat.lastPractice,
    due: stat.due,
    stability: stat.stability,
    difficulty: stat.difficulty,
    reps: stat.reps,
    lapses: stat.lapses,
    fsrsState: stat.fsrsState,
    lastReview: stat.lastReview,
    retrievability: stat.retrievability,
    recentLapse: stat.recentLapse,
    needsReconfirm: stat.needsReconfirm
  }
}

function buildSummary(words: MapWordEntry[]) {
  const mastered = words.filter(w => w.status === 'mastered').length
  const learning = words.filter(w => w.status === 'learning').length
  const unfamiliar = words.filter(w => w.status === 'unfamiliar').length
  const unpracticed = words.filter(w => w.status === 'unpracticed').length
  const practiced = words.length - unpracticed

  return {
    mastered,
    learning,
    unfamiliar,
    unpracticed,
    practiced,
    coverageRate: words.length > 0 ? Math.round((practiced / words.length) * 100) : 0
  }
}

function buildContentTypeStats(words: MapWordEntry[]): CategoryStats[] {
  const types: ContentType[] = ['fiction', 'non-fiction', 'function']

  return types.map(type => {
    const subset = words.filter(w => w.contentType === type)
    const mastered = subset.filter(w => w.status === 'mastered').length
    const learning = subset.filter(w => w.status === 'learning').length
    const weak = subset.filter(w => w.status === 'unfamiliar').length
    const unpracticed = subset.filter(w => w.status === 'unpracticed').length
    const avgMastery = subset.length > 0
      ? Math.round(subset.reduce((s, w) => s + w.mastery, 0) / subset.length)
      : 0

    return {
      type,
      label: getContentTypeLabel(type),
      mastered,
      learning,
      weak,
      unpracticed,
      avgMastery,
      wordCount: subset.length
    }
  }).filter(c => c.wordCount > 0)
}

function buildTopicStats(words: MapWordEntry[]): TopicStats[] {
  return TOPIC_CATEGORIES.map(meta => {
    const subset = words.filter(w => w.topic === meta.id)
    const weakCount = subset.filter(w => w.status === 'unfamiliar' || w.status === 'unpracticed').length
    const mastered = subset.filter(w => w.status === 'mastered').length
    const avgMastery = subset.length > 0
      ? Math.round(subset.reduce((s, w) => s + w.mastery, 0) / subset.length)
      : 0

    return {
      topic: meta.id,
      label: meta.label,
      avgMastery,
      weakCount,
      wordCount: subset.length,
      mastered
    }
  }).filter(t => t.wordCount > 0)
    .sort((a, b) => a.avgMastery - b.avgMastery)
}

interface WordRow {
  id: string
  word: string
  meaning: string
  phonetic?: string | null
  phoneticUk?: string | null
  phoneticUs?: string | null
  contentType: string | null
  topic: string | null
  tags: string[]
}

function emptyAggregated(wordId: string): NonNullable<ReturnType<typeof aggregateWordMastery>> {
  return {
    wordId,
    mastery: 0,
    practiced: false,
    practiceCount: 0,
    byType: {},
    recognize: null,
    write: null,
    skill: 'none',
    skillLabel: '未练习',
    needsReconfirm: false,
    lastPractice: null
  }
}

function combinedStatus(aggregated: NonNullable<ReturnType<typeof aggregateWordMastery>>): string {
  if (aggregated.skill === 'none' || !aggregated.practiced) return 'unpracticed'
  if (aggregated.skill === 'mastered') return 'mastered'
  if (aggregated.skill === 'partial' && aggregated.mastery < 2) return 'unfamiliar'
  return 'learning'
}

function toWordRow(word: {
  id: string
  word: string
  meaning: string
  phonetic?: string | null
  phoneticUk?: string | null
  phoneticUs?: string | null
  contentType?: string | null
  topic?: string | null
  tags?: string[] | null
}): WordRow {
  return {
    id: word.id,
    word: word.word,
    meaning: word.meaning,
    phonetic: word.phonetic || null,
    phoneticUk: word.phoneticUk || null,
    phoneticUs: word.phoneticUs || null,
    contentType: word.contentType || null,
    topic: word.topic || null,
    tags: word.tags || []
  }
}

function toMapWord(word: WordRow, aggregated: NonNullable<ReturnType<typeof aggregateWordMastery>>): MapWordEntry {
  return {
    wordId: word.id,
    word: word.word,
    meaning: word.meaning,
    phonetic: word.phonetic || null,
    phoneticUk: word.phoneticUk || null,
    phoneticUs: word.phoneticUs || null,
    contentType: (word.contentType as ContentType) || null,
    topic: (word.topic as TopicCategory) || null,
    tags: word.tags || [],
    mastery: aggregated.mastery,
    status: combinedStatus(aggregated),
    lastPractice: aggregated.lastPractice?.toISOString() || null,
    byType: aggregated.byType as Record<string, number>,
    recognize: aggregated.recognize,
    write: aggregated.write,
    skillLabel: aggregated.skillLabel
  }
}

/* ═══════════════════════════════════════════
 *  Public APIs
 * ═══════════════════════════════════════════ */

/** Book-level vocabulary map */
export async function getBookMap(userId: string, bookCode: string) {
  const book = await getBookByCode(bookCode)
  if (!book) {
    throw new Error('Book not found')
  }

  const bookWords = book.vocabulary.sort((a, b) => a.sortOrder - b.sortOrder)
  const wordIds = bookWords.map(bv => bv.wordId)
  const statsMap = await loadStatsMap(userId, wordIds)
  const aggregated = aggregateBookWordStats(wordIds, statsMap)

  const words: MapWordEntry[] = bookWords.map(bv =>
    toMapWord(toWordRow(bv.word), aggregated.get(bv.wordId) || emptyAggregated(bv.wordId))
  )

  const byTopic = buildTopicStats(words)
  const weakestTopics = byTopic
    .filter(t => t.wordCount >= 2)
    .slice(0, 3)
    .map(t => t.topic)

  return {
    book: { code: book.code, name: book.name, wordCount: book.wordCount },
    summary: buildSummary(words),
    byContentType: buildContentTypeStats(words),
    byTopic,
    words,
    weakestTopics
  }
}

/**
 * Global vocabulary map = union of all books' words (deduped by wordId).
 * Mastery comes from learner stats when present; otherwise unpracticed.
 * `groups` lists which books contain each word.
 */
export async function getGlobalMap(
  userId: string,
  limit = 8000,
  allowedBookCodes?: ReadonlySet<string>
) {
  const bvRows = await prisma.bookVocabulary.findMany({
    where: allowedBookCodes
      ? { book: { code: { in: [...allowedBookCodes] } } }
      : undefined,
    include: {
      word: true,
      book: { select: { code: true, name: true } }
    },
    orderBy: [{ bookId: 'asc' }, { sortOrder: 'asc' }]
  })

  const wordDataMap = new Map<string, WordRow>()
  const wordGroupMap = new Map<string, WordBookGroup[]>()

  for (const bv of bvRows) {
    if (!bv.word) continue
    const wid = bv.wordId
    if (!wordDataMap.has(wid)) {
      wordDataMap.set(wid, toWordRow(bv.word))
    }
    const groups = wordGroupMap.get(wid) || []
    if (!groups.find(g => g.bookCode === bv.book.code)) {
      groups.push({
        bookCode: bv.book.code,
        bookName: bv.book.name,
        mastery: 0,
        practiced: false,
        practiceCount: 0
      })
      wordGroupMap.set(wid, groups)
    }
  }

  const uniqueWordIds = [...wordDataMap.keys()]
  const statsMap = await loadStatsMap(userId, uniqueWordIds)
  const aggregatedMap = aggregateBookWordStats(uniqueWordIds, statsMap)

  // Fill per-book group mastery from the learner's overall word mastery
  // (stats are per word, not per book — same mastery shared across books)
  for (const [wid, groups] of wordGroupMap) {
    const agg = aggregatedMap.get(wid) || emptyAggregated(wid)
    for (const g of groups) {
      g.mastery = agg.mastery
      g.practiced = agg.practiced
      g.practiceCount = agg.practiceCount
    }
  }

  const words: GroupedMapWordEntry[] = uniqueWordIds
    .slice(0, Math.max(1, limit))
    .map((wordId) => {
      const wd = wordDataMap.get(wordId)!
      const aggregated = aggregatedMap.get(wordId) || emptyAggregated(wordId)
      const entry = toMapWord(wd, aggregated)
      const groups = wordGroupMap.get(wordId)?.sort((a, b) => b.mastery - a.mastery)
      return { ...entry, groups } as GroupedMapWordEntry
    })

  const byTopic = buildTopicStats(words)
  const weakestTopics = byTopic.filter(t => t.wordCount >= 2).slice(0, 3).map(t => t.topic)

  return {
    summary: {
      ...buildSummary(words),
      totalUniqueWords: words.length,
      masteredWords: words.filter(w => w.status === 'mastered').length
    },
    byContentType: buildContentTypeStats(words),
    byTopic,
    words,
    weakestTopics
  }
}

function buildTypeStats(
  statsMap: Map<string, WordStatEntry[]>,
  wordId: string,
  trainingType: string
) {
  const entry = statsMap.get(wordId)?.find(s => s.type === trainingType)
  const stats = buildTypeStatsFromEntry(entry)
  return { ...stats, due: stats.due?.toISOString() ?? null }
}

/** Book-word stats filtered by training type */
export async function getBookWordStats(userId: string, bookCode: string, trainingType?: string) {
  const book = await getBookByCode(bookCode)
  if (!book) throw new Error('Book not found')

  if (!trainingType) return getBookMap(userId, bookCode)

  const map = await getBookMap(userId, bookCode)
  const wordIds = book.vocabulary.map(bv => bv.wordId)
  const statsMap = await loadStatsMap(userId, wordIds)

  const words = map.words.map(w => {
    const entry = statsMap.get(w.wordId)?.find(s => s.type === trainingType)
    const typeStats = buildTypeStats(statsMap, w.wordId, trainingType)
    const practiced = typeStats.practiceCount > 0
    return {
      ...w,
      mastery: practiced ? typeStats.mastery : 0,
      status: getMasteryStatus(practiced ? typeStats.mastery : 0, practiced, entry),
      typeStats
    }
  })

  // Recalculate summary + breakdowns based on filtered words
  const filteredSummary = buildSummary(words)
  const filteredByContentType = buildContentTypeStats(words)
  const filteredByTopic = buildTopicStats(words)
  const filteredWeakestTopics = filteredByTopic
    .filter(t => t.wordCount >= 2)
    .slice(0, 3)
    .map(t => t.topic)

  return {
    book: map.book,
    summary: filteredSummary,
    byContentType: filteredByContentType,
    byTopic: filteredByTopic,
    words,
    weakestTopics: filteredWeakestTopics
  }
}
