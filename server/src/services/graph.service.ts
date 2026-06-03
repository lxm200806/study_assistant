import prisma from '../prisma/client'
import { getBookByCode } from './book.service'
import {
  aggregateBookWordStats,
  getMasteryStatus,
  type WordStatEntry
} from './mastery-aggregate.service'
import { getContentTypeLabel, getTopicLabel, TOPIC_CATEGORIES } from '../data/taxonomy'
import type { ContentType, TopicCategory } from '../data/vocabulary/types'

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

async function loadStatsMap(userId: string, wordIds: string[]): Promise<Map<string, WordStatEntry[]>> {
  const stats = await prisma.vocabularyStat.findMany({
    where: { userId, wordId: { in: wordIds } }
  })
  const map = new Map<string, WordStatEntry[]>()
  for (const stat of stats) {
    const list = map.get(stat.wordId) || []
    list.push({
      wordId: stat.wordId,
      type: stat.type as WordStatEntry['type'],
      practiceCount: stat.practiceCount,
      correctCount: stat.correctCount,
      mastery: stat.mastery,
      lastPractice: stat.lastPractice
    })
    map.set(stat.wordId, list)
  }
  return map
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

function toMapWord(
  word: {
    id: string
    word: string
    meaning: string
    contentType: string | null
    topic: string | null
    tags: string[]
  },
  aggregated: ReturnType<typeof aggregateBookWordStats> extends Map<string, infer V> ? V : never
): MapWordEntry {
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
    book: {
      code: book.code,
      name: book.name,
      wordCount: book.wordCount
    },
    summary: buildSummary(words),
    byContentType: buildContentTypeStats(words),
    byTopic,
    words,
    weakestTopics
  }
}

export async function getGlobalMap(userId: string) {
  const allStats = await prisma.vocabularyStat.findMany({
    where: { userId },
    include: { word: true }
  })

  const wordStatsMap = new Map<string, WordStatEntry[]>()
  for (const stat of allStats) {
    const list = wordStatsMap.get(stat.wordId) || []
    list.push({
      wordId: stat.wordId,
      type: stat.type as WordStatEntry['type'],
      practiceCount: stat.practiceCount,
      correctCount: stat.correctCount,
      mastery: stat.mastery,
      lastPractice: stat.lastPractice
    })
    wordStatsMap.set(stat.wordId, list)
  }

  const wordMap = new Map<string, {
    word: typeof allStats[0]['word']
    aggregated: NonNullable<ReturnType<typeof aggregateBookWordStats> extends Map<string, infer V> ? V : never>
  }>()

  for (const stat of allStats) {
    const existing = wordMap.get(stat.wordId)
    const entries = wordStatsMap.get(stat.wordId) || []
    const aggregated = aggregateBookWordStats([stat.wordId], wordStatsMap).get(stat.wordId)!

    if (!existing || aggregated.mastery > existing.aggregated.mastery) {
      wordMap.set(stat.wordId, { word: stat.word, aggregated })
    }
  }

  const words: MapWordEntry[] = [...wordMap.values()].map(({ word, aggregated }) =>
    toMapWord(word, aggregated)
  )

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

export async function getBookWordStats(userId: string, bookCode: string, trainingType?: string) {
  const map = await getBookMap(userId, bookCode)
  if (!trainingType) return map

  const words = map.words.map(w => ({
    ...w,
    mastery: w.byType[trainingType] ?? 0,
    status: getMasteryStatus(
      w.byType[trainingType] ?? 0,
      (w.byType[trainingType] ?? 0) > 0
    )
  }))

  return {
    ...map,
    words,
    summary: buildSummary(words),
    byContentType: buildContentTypeStats(words),
    byTopic: buildTopicStats(words)
  }
}
