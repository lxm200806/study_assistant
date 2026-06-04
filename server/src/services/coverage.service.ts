import prisma from '../prisma/client'
import { formatWordForClient } from '../utils/wordFormat'
import {
  aggregateBookWordStats,
  getPriorityScore,
  getMasteryStatus,
  type WordStatEntry
} from './mastery-aggregate.service'
import {
  buildFsrsFieldsFromStat,
  computeWeakPriorityScore
} from './review-engine.service'
import { getBookByCode } from './book.service'

export type SessionMode = 'coverage' | 'random' | 'weak' | 'review'

export interface BookProgressInfo {
  bookCode: string
  wordCount: number
  practicedCount: number
  coverageRate: number
  cycleRemaining: number
  cyclePracticedCount: number
}

export async function getBookProgress(userId: string, bookCode: string): Promise<BookProgressInfo> {
  const book = await getBookByCode(bookCode)
  if (!book) {
    throw new Error('Book not found')
  }

  const wordIds = book.vocabulary.map(bv => bv.wordId)
  const stats = await loadUserWordStats(userId, wordIds)
  const aggregated = aggregateBookWordStats(wordIds, stats)

  const practicedCount = [...aggregated.values()].filter(m => m.practiced).length
  const progress = await prisma.bookStudyProgress.findUnique({
    where: { userId_bookId: { userId, bookId: book.id } }
  })
  const cyclePracticed = progress?.practicedWordIds.length || 0

  return {
    bookCode,
    wordCount: wordIds.length,
    practicedCount,
    coverageRate: wordIds.length > 0 ? Math.round((practicedCount / wordIds.length) * 100) : 0,
    cycleRemaining: Math.max(0, wordIds.length - cyclePracticed),
    cyclePracticedCount: cyclePracticed
  }
}

async function loadUserWordStats(userId: string, wordIds: string[]): Promise<Map<string, WordStatEntry[]>> {
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
    })
    map.set(stat.wordId, list)
  }
  return map
}

function getTypeStat(
  statsMap: Map<string, WordStatEntry[]>,
  wordId: string,
  trainingType?: string
): WordStatEntry | undefined {
  if (!trainingType) return undefined
  return statsMap.get(wordId)?.find(s => s.type === trainingType)
}

function computeScore(
  bvWordId: string,
  statsMap: Map<string, WordStatEntry[]>,
  aggregated: ReturnType<typeof aggregateBookWordStats> extends Map<string, infer V> ? V : never,
  inCycle: boolean,
  mode: SessionMode,
  trainingType?: string
): number {
  const typeStat = getTypeStat(statsMap, bvWordId, trainingType)
  const now = new Date()

  if (mode === 'weak' || mode === 'review') {
    if (typeStat) {
      return computeWeakPriorityScore(buildFsrsFieldsFromStat(typeStat, now))
    }
    if (!aggregated.practiced) return 500
    return getPriorityScore(aggregated, inCycle)
  }

  return getPriorityScore(aggregated, inCycle, typeStat)
}

export async function getSessionWords(
  userId: string,
  bookCode: string,
  count: number,
  mode: SessionMode = 'coverage',
  trainingType?: string
) {
  const book = await getBookByCode(bookCode)
  if (!book) {
    throw new Error('Book not found')
  }

  const bookWords = book.vocabulary.sort((a, b) => a.sortOrder - b.sortOrder)
  const wordIds = bookWords.map(bv => bv.wordId)
  const statsMap = await loadUserWordStats(userId, wordIds)
  const aggregated = aggregateBookWordStats(wordIds, statsMap)
  const now = new Date()

  let progress = await prisma.bookStudyProgress.findUnique({
    where: { userId_bookId: { userId, bookId: book.id } }
  })

  if (!progress) {
    progress = await prisma.bookStudyProgress.create({
      data: { userId, bookId: book.id, practicedWordIds: [] }
    })
  }

  const cycleSet = new Set(progress.practicedWordIds)

  if (mode === 'random') {
    const shuffled = [...bookWords].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, count)
    const progressInfo = await getBookProgress(userId, bookCode)
    return {
      words: selected.map(bv => formatWordForClient(bv.word)),
      progress: progressInfo,
      mode
    }
  }

  if (mode === 'review') {
    const dueWords = bookWords.filter(bv => {
      const typeStat = getTypeStat(statsMap, bv.wordId, trainingType)
      return typeStat?.due != null && typeStat.due.getTime() <= now.getTime()
    })

    let selectedBookWords = dueWords.slice(0, count)

    if (selectedBookWords.length < count) {
      const dueIds = new Set(selectedBookWords.map(bv => bv.wordId))
      const scored = bookWords
        .filter(bv => !dueIds.has(bv.wordId))
        .map(bv => ({
          bv,
          score: computeScore(bv.wordId, statsMap, aggregated.get(bv.wordId)!, cycleSet.has(bv.wordId), 'weak', trainingType)
        }))
        .sort((a, b) => b.score - a.score)
      selectedBookWords = [
        ...selectedBookWords,
        ...scored.slice(0, count - selectedBookWords.length).map(s => s.bv)
      ]
    }

    const progressInfo = await getBookProgress(userId, bookCode)
    return {
      words: selectedBookWords.map(bv => formatWordForClient(bv.word)),
      progress: progressInfo,
      mode
    }
  }

  const scored = bookWords.map(bv => {
    const mastery = aggregated.get(bv.wordId)!
    const inCycle = cycleSet.has(bv.wordId)
    let score = computeScore(bv.wordId, statsMap, mastery, inCycle, mode, trainingType)

    if (mode === 'coverage' && inCycle) {
      score -= 500
    }

    return { bv, score, mastery }
  })

  scored.sort((a, b) => b.score - a.score)

  const unpracticedInCycle = bookWords.filter(bv => !cycleSet.has(bv.wordId))
  let selectedBookWords = scored.slice(0, count).map(s => s.bv)

  if (mode === 'coverage' && unpracticedInCycle.length > 0) {
    const needFromCycle = Math.min(count, unpracticedInCycle.length)
    const cycleWords = unpracticedInCycle.slice(0, needFromCycle)
    const cycleIds = new Set(cycleWords.map(bv => bv.wordId))
    const rest = scored
      .filter(s => !cycleIds.has(s.bv.wordId))
      .slice(0, count - needFromCycle)
      .map(s => s.bv)
    selectedBookWords = [...cycleWords, ...rest]
  }

  const progressInfo = await getBookProgress(userId, bookCode)

  return {
    words: selectedBookWords.map(bv => formatWordForClient(bv.word)),
    progress: progressInfo,
    mode
  }
}

export async function markWordsPracticed(userId: string, bookCode: string, wordIds: string[]) {
  const book = await prisma.book.findUnique({ where: { code: bookCode } })
  if (!book) return

  let progress = await prisma.bookStudyProgress.findUnique({
    where: { userId_bookId: { userId, bookId: book.id } }
  })

  if (!progress) {
    progress = await prisma.bookStudyProgress.create({
      data: { userId, bookId: book.id, practicedWordIds: wordIds }
    })
    return progress
  }

  const bookWordCount = await prisma.bookVocabulary.count({ where: { bookId: book.id } })
  const merged = [...new Set([...progress.practicedWordIds, ...wordIds])]

  if (merged.length >= bookWordCount) {
    return prisma.bookStudyProgress.update({
      where: { id: progress.id },
      data: {
        practicedWordIds: wordIds,
        cycleStartedAt: new Date()
      }
    })
  }

  return prisma.bookStudyProgress.update({
    where: { id: progress.id },
    data: { practicedWordIds: merged }
  })
}

export async function getNewlyCoveredCount(
  userId: string,
  bookCode: string,
  wordIds: string[]
): Promise<number> {
  const book = await prisma.book.findUnique({ where: { code: bookCode } })
  if (!book) return 0

  const progress = await prisma.bookStudyProgress.findUnique({
    where: { userId_bookId: { userId, bookId: book.id } }
  })

  const previous = new Set(progress?.practicedWordIds || [])
  return wordIds.filter(id => !previous.has(id)).length
}

export { getMasteryStatus }
