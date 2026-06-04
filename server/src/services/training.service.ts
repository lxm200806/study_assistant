import prisma from '../prisma/client'
import { PracticeDto, WordType } from '../types'
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
  const now = new Date()
  const existingStat = await prisma.vocabularyStat.findUnique({
    where: {
      userId_wordId_type: {
        userId,
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

  const updatedStat = existingStat
    ? await prisma.vocabularyStat.update({
        where: { id: existingStat.id },
        data: {
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
          recentLapse: fields.recentLapse
        },
        include: { word: true }
      })
    : await prisma.vocabularyStat.create({
        data: {
          userId,
          wordId: dto.wordId,
          type: dto.type,
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
          recentLapse: fields.recentLapse
        },
        include: { word: true }
      })

  await prisma.trainingRecord.create({
    data: {
      userId,
      wordId: dto.wordId,
      type: dto.type,
      isCorrect: dto.isCorrect
    }
  })

  return toPracticeResult(updatedStat.wordId, dto.type, fields)
}

export interface ReviewWordsOptions {
  type?: WordType
  bookCode?: string
  limit?: number
}

export async function getReviewWords(userId: string, options: ReviewWordsOptions = {}) {
  const now = new Date()
  const { type, bookCode, limit = 50 } = options

  let wordIds: string[] | undefined
  if (bookCode) {
    const book = await prisma.book.findUnique({
      where: { code: bookCode },
      include: { vocabulary: true }
    })
    if (!book) return []
    wordIds = book.vocabulary.map(bv => bv.wordId)
  }

  const stats = await prisma.vocabularyStat.findMany({
    where: {
      userId,
      practiceCount: { gt: 0 },
      due: { lte: now },
      ...(type ? { type } : {}),
      ...(wordIds ? { wordId: { in: wordIds } } : {})
    },
    include: { word: true },
    orderBy: { due: 'asc' },
    take: limit
  })

  return stats.map(stat => ({
    ...stat,
    status: getMasteryStatus(buildFsrsFieldsFromStat(stat, now)),
    weakReason: getWeakReason(buildFsrsFieldsFromStat(stat, now))
  }))
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

  const wordIds = book.vocabulary.map(bv => bv.wordId)
  const dueCount = await prisma.vocabularyStat.count({
    where: {
      userId,
      wordId: { in: wordIds },
      practiceCount: { gt: 0 },
      due: { lte: now },
      ...(trainingType ? { type: trainingType } : {})
    }
  })

  return { dueCount, overdueCount: dueCount }
}

export async function getTrainingHistory(userId: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit

  return prisma.trainingRecord.findMany({
    where: { userId },
    include: { word: true },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit
  })
}
