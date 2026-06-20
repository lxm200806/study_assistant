import prisma from '../prisma/client'
import { getBookByCode } from './book.service'
import {
  aggregateWordMastery,
  aggregateBookWordStats,
  getMasteryStatus,
  buildTypeStatsFromEntry,
  type WordStatEntry
} from './mastery-aggregate.service'
import { getContentTypeLabel, getTopicLabel, TOPIC_CATEGORIES } from '../data/taxonomy'
import type { ContentType, TopicCategory } from '../data/vocabulary/types'

/* ═══════════════════════════════════════════
 *  Type Definitions
 * ═══════════════════════════════════════════ */

export interface MapWordEntry {
  wordId: string
  word: string
  meaning: string
  contentType: ContentType | null
  topic: TopicCategory | null
  tags: string[]
  mastery: number
  status: string
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
  const stats = await prisma.vocabularyStat.findMany({
    where: { userId, wordId: { in: wordIds } }
  })
  const map = new Map<string, WordStatEntry[]>()
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
    recentLapse: stat.recentLapse
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
  contentType: string | null
  topic: string | null
  tags: string[]
}

function toMapWord(word: WordRow, aggregated: NonNullable<ReturnType<typeof aggregateWordMastery>>): MapWordEntry {
  const status = getMasteryStatus(aggregated.mastery, aggregated.practiced)
  return {
    wordId: word.id,
    word: word.word,
    meaning: word.meaning,
    contentType: (word.contentType as ContentType) || null,
    topic: (word.topic as TopicCategory) || null,
    tags: word.tags || [],
    mastery: aggregated.mastery,
    status,
    lastPractice: aggregated.lastPractice?.toISOString() || null,
    byType: aggregated.byType as Record<string, number>
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
    toMapWord(bv.word, aggregated.get(bv.wordId)!)
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
 * Global vocabulary map with multi-book grouping.
 * Each word can belong to multiple books; `groups` shows per-book mastery.
 * @param userId   - user identifier
 * @param limit    - max words returned (default: 500)
 */
export async function getGlobalMap(userId: string, limit = 500) {
  // Step 1: fetch all stats with word data (no bookVocabulary include since no relation exists)
  const allStats = await prisma.vocabularyStat.findMany({
    where: { userId },
    include: { word: true },
    orderBy: { wordId: 'asc' }
  })

  // Step 2: collect unique wordIds for book lookup
  const uniqueWordIds = [...new Set(allStats.map(s => s.wordId))]

  // Step 3: fetch book associations for these words (one additional query)
  let bookAssociations: Array<{ wordId: string; bookCode: string; bookName: string }> = []
  if (uniqueWordIds.length > 0) {
    const bvRows = await prisma.bookVocabulary.findMany({
      where: { wordId: { in: uniqueWordIds } },
      include: { book: { select: { code: true, name: true } } }
    })
    bookAssociations = bvRows.map(bv => ({
      wordId: bv.wordId,
      bookCode: bv.book.code,
      bookName: bv.book.name
    }))
  }

  // Step 4: build lookup maps
  const wordGroupMap = new Map<string, WordBookGroup[]>()
  for (const assoc of bookAssociations) {
    if (!wordGroupMap.has(assoc.wordId)) wordGroupMap.set(assoc.wordId, [])
    // deduplicate by bookCode
    const groups = wordGroupMap.get(assoc.wordId)!
    if (!groups.find(g => g.bookCode === assoc.bookCode)) {
      groups.push({
        bookCode: assoc.bookCode,
        bookName: assoc.bookName,
        mastery: 0, // will be filled below from stats
        practiced: false,
        practiceCount: 0
      })
    }
  }

  // Step 5: aggregate by wordId (single O(n) pass over allStats)
  const wordStatsAll = new Map<string, WordStatEntry[]>()
  const wordDataMap = new Map<string, WordRow>()
  const statsToBookGroup = new Map<string, { mastery: number; practiced: boolean; practiceCount: number }>()

  for (const stat of allStats) {
    const wid = stat.wordId

    // collect all stats entries per word
    const entries = wordStatsAll.get(wid) || []
    entries.push(statToWordEntry(stat))
    wordStatsAll.set(wid, entries)

    // store word data (first occurrence wins)
    if (!wordDataMap.has(wid) && stat.word) {
      wordDataMap.set(wid, {
        id: stat.word.id,
        word: stat.word.word,
        meaning: stat.word.meaning,
        contentType: stat.word.contentType,
        topic: stat.word.topic,
        tags: stat.word.tags || []
      })
    }

    // Track the "best" book group for this stat (highest mastery)
    const bestGroup = wordGroupMap.get(wid)?.[0]
    if (bestGroup) {
      const key = `${wid}:${bestGroup.bookCode}`
      const existing = statsToBookGroup.get(key)
      if (!existing || stat.mastery > existing.mastery) {
        statsToBookGroup.set(key, {
          mastery: stat.mastery,
          practiced: stat.practiceCount > 0,
          practiceCount: stat.practiceCount
        })
      }
    }
  }

  // Update book groups with actual mastery values from stats
  for (const [key, val] of statsToBookGroup) {
    const [wid, bookCode] = key.split(':')
    const groups = wordGroupMap.get(wid)
    if (groups) {
      const g = groups.find(bg => bg.bookCode === bookCode)
      if (g) { Object.assign(g, val) }
    }
  }

  // Step 6: aggregate mastery per-word (O(n) single pass)
  interface WordEntry {
    wordData: WordRow
    aggregated: NonNullable<ReturnType<typeof aggregateWordMastery>>
  }
  const wordsMap = new Map<string, WordEntry>()

  for (const [wordId, entries] of wordStatsAll) {
    const agg = aggregateWordMastery(entries)
    if (!agg || !wordDataMap.has(wordId)) continue

    const existing = wordsMap.get(wordId)
    if (!existing || agg.mastery > existing.aggregated.mastery) {
      wordsMap.set(wordId, { wordData: wordDataMap.get(wordId)!, aggregated: agg })
    }
  }

  // Step 7: build output array (with groups, truncated to limit)
  const words: GroupedMapWordEntry[] = [...wordsMap.entries()]
    .slice(0, limit)
    .map(([wordId, { wordData: wd, aggregated }]) => {
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
