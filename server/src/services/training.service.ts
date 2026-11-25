import prisma from '../prisma/client'
import { PracticeDto, WordType } from '../types'

const TRAINING_TYPES: WordType[] = ['listening', 'speaking', 'reading', 'writing']
const HOME_REVIEW_PER_TYPE = 5
import {
  processPractice,
  buildFsrsFieldsFromStat,
  getMasteryStatus,
  getWeakReason,
  type FsrsStatFields
} from './review-engine.service'

export interface PracticeResult extends FsrsStatFields {
  wordId: string
  type: WordType
  status: ReturnType<typeof getMasteryStatus>
  weakReason?: ReturnType<typeof getWeakReason>
  needsReconfirm?: boolean
}

const TX_MAX_ATTEMPTS = 3
const RETRYABLE_PRISMA_CODES = new Set(['P2034', 'P2002'])

export function isRetryableTransactionError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && RETRYABLE_PRISMA_CODES.has(code)
}

function toPracticeResult(
  wordId: string,
  type: WordType,
  fields: FsrsStatFields
): PracticeResult {
  const status = getMasteryStatus(fields)
  const weakReason = getWeakReason(fields)
  return {
    wordId,
    type,
    ...fields,
    status,
    weakReason
  }
}

export async function practice(userId: string, dto: PracticeDto): Promise<PracticeResult> {
  let lastError: unknown

  for (let attempt = 1; attempt <= TX_MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async tx => {
          const now = new Date()
          const existingStat = await tx.vocabularyStat.findUnique({
            where: {
              learnerId_wordId_type: {
                learnerId: userId,
                wordId: dto.wordId,
                type: dto.type
              }
            }
          })

          const input = existingStat ?? {
            practiceCount: 0,
            correctCount: 0,
            reps: 0,
            lapses: 0,
            fsrsState: 'New',
            recentLapse: false
          }

          const fields = processPractice(input, dto.isCorrect, now)
          // 答对即视为完成跨书核对；答错保留现状，由 recheck 接口置为待核对。
          const needsReconfirm = dto.isCorrect ? false : (existingStat?.needsReconfirm ?? false)
          const statData = {
            practiceCount: fields.practiceCount,
            correctCount: fields.correctCount,
            lastPractice: fields.lastPractice,
            mastery: fields.mastery,
            due: fields.due,
            stability: fields.stability,
            difficulty: fields.difficulty,
            reps: fields.reps,
            lapses: fields.lapses,
            fsrsState: fields.fsrsState,
            lastReview: fields.lastReview,
            retrievability: fields.retrievability,
            recentLapse: fields.recentLapse,
            needsReconfirm,
            learningSteps: fields.learningSteps,
            scheduledDays: fields.scheduledDays
          }

          if (existingStat) {
            await tx.vocabularyStat.update({
              where: { id: existingStat.id },
              data: statData
            })
          } else {
            await tx.vocabularyStat.create({
              data: {
                learnerId: userId,
                wordId: dto.wordId,
                type: dto.type,
                ...statData
              }
            })
          }

          await tx.trainingRecord.create({
            data: {
              learnerId: userId,
              wordId: dto.wordId,
              type: dto.type,
              isCorrect: dto.isCorrect
            }
          })

          return { ...toPracticeResult(dto.wordId, dto.type, fields), needsReconfirm }
        },
        { isolationLevel: 'Serializable' }
      )
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === TX_MAX_ATTEMPTS) {
        throw error
      }
      lastError = error
      await new Promise(resolve => setTimeout(resolve, attempt * 10))
    }
  }

  throw lastError ?? new Error('practice transaction failed')
}

export interface ReviewWordsOptions {
  type?: WordType
  bookCode?: string
  limit?: number
}

async function fetchDueStatsByType(
  userId: string,
  options: { wordIds?: string[]; type: WordType; perTypeLimit: number }
) {
  const now = new Date()
  const { wordIds, type, perTypeLimit } = options

  return prisma.vocabularyStat.findMany({
    where: {
      learnerId: userId,
      practiceCount: { gt: 0 },
      type,
      OR: [{ due: { lte: now } }, { needsReconfirm: true }],
      ...(wordIds ? { wordId: { in: wordIds } } : {})
    },
    include: { word: true },
    orderBy: [{ needsReconfirm: 'desc' }, { due: 'asc' }],
    take: perTypeLimit
  })
}

async function getAggregatedDueStats(
  userId: string,
  bookCode: string | undefined,
  perTypeLimit: number
) {
  let wordIds: string[] | undefined
  if (bookCode) {
    const book = await prisma.book.findUnique({
      where: { code: bookCode },
      include: { vocabulary: true }
    })
    if (!book) return []
    wordIds = book.vocabulary.map(bv => bv.wordId)
  }

  const statsByType = await Promise.all(
    TRAINING_TYPES.map(type =>
      fetchDueStatsByType(userId, { wordIds, type, perTypeLimit })
    )
  )

  return dedupeReviewStatsByWord(statsByType.flat())
}

export async function getReviewWords(userId: string, options: ReviewWordsOptions = {}) {
  const now = new Date()
  const { type, bookCode, limit = 50 } = options

  const selected = type
    ? await fetchDueStatsByType(userId, {
        wordIds: bookCode
          ? (await prisma.book.findUnique({
              where: { code: bookCode },
              include: { vocabulary: true }
            }))?.vocabulary.map(bv => bv.wordId)
          : undefined,
        type,
        perTypeLimit: limit
      })
    : (await getAggregatedDueStats(
        userId,
        bookCode,
        Math.max(1, Math.ceil(limit / TRAINING_TYPES.length))
      )).slice(0, limit)

  return selected.map(stat => ({
    ...stat,
    status: getMasteryStatus(buildFsrsFieldsFromStat(stat, now)),
    weakReason: getWeakReason(buildFsrsFieldsFromStat(stat, now))
  }))
}

function dedupeReviewStatsByWord<T extends { wordId: string; due: Date | null }>(stats: T[]): T[] {
  const seen = new Map<string, T>()
  for (const stat of stats) {
    if (!seen.has(stat.wordId)) {
      seen.set(stat.wordId, stat)
    }
  }
  return [...seen.values()]
}

export async function getDueCount(userId: string, bookCode: string, trainingType?: WordType) {
  const now = new Date()
  const book = await prisma.book.findUnique({
    where: { code: bookCode },
    include: { vocabulary: true }
  })
  if (!book) {
    return { dueCount: 0, overdueCount: 0 }
  }

  const dueWords = await prisma.vocabularyStat.findMany({
    where: {
      learnerId: userId,
      wordId: { in: book.vocabulary.map(bv => bv.wordId) },
      practiceCount: { gt: 0 },
      OR: [{ due: { lte: now } }, { needsReconfirm: true }],
      ...(trainingType ? { type: trainingType } : {})
    },
    select: { wordId: true },
    distinct: ['wordId']
  })

  return { dueCount: dueWords.length, overdueCount: dueWords.length }
}

export async function getTrainingHistory(userId: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit

  return prisma.trainingRecord.findMany({
    where: { learnerId: userId },
    include: { word: true },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit
  })
}
