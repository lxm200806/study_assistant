import { Request, Response } from 'express'
import { practice, getReviewWords, getTrainingHistory } from '../services/training.service'
import { markWordsPracticed, getNewlyCoveredCount } from '../services/coverage.service'
import { recordDailyStudy } from '../services/daily-study.service'
import { assertBookAccess } from '../services/book-access.service'
import prisma from '../prisma/client'
import { clampInt } from '../utils/pagination'
import type { WordType } from '../types'
import { studyUserId } from '../middleware/auth'

const MAX_SESSION_WORDS = 200
const TRAINING_TYPES: WordType[] = ['listening', 'speaking', 'reading', 'writing']

function studyOrReply(req: Request, res: Response) {
  try {
    return studyUserId(req)
  } catch (error) {
    res.status(409).json({ success: false, error: (error as Error).message })
    return null
  }
}

export async function practiceHandler(req: Request, res: Response) {
  try {
    const userId = studyOrReply(req, res)
    if (!userId) return
    const { wordId, type, isCorrect } = req.body

    if (!wordId || !type || typeof isCorrect !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Invalid request body' })
    }

    const result = await practice(userId, { wordId, type, isCorrect })
    res.status(200).json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getReviewHandler(req: Request, res: Response) {
  try {
    const userId = studyOrReply(req, res)
    if (!userId) return
    const type = req.query.type as WordType | undefined
    const bookCode = req.query.bookCode as string | undefined
    const limit = clampInt(req.query.limit, 50, 1, MAX_SESSION_WORDS)

    if (bookCode) {
      await assertBookAccess(userId, bookCode)
    }

    const words = await getReviewWords(userId, { type, bookCode, limit })
    res.status(200).json({ success: true, data: words })
  } catch (error) {
    const message = (error as Error).message
    res.status(message === 'BOOK_LOCKED' ? 403 : 500).json({ success: false, error: message })
  }
}

export async function getHistoryHandler(req: Request, res: Response) {
  try {
    const userId = studyOrReply(req, res)
    if (!userId) return
    const page = clampInt(req.query.page, 1, 1, 100000)
    const limit = clampInt(req.query.limit, 20, 1, 100)

    const history = await getTrainingHistory(userId, page, limit)
    res.status(200).json({ success: true, data: history })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

/**
 * 跨书核对：别的书学过的词，在本书里再确认一次。
 * 答对：掌握度 +1（最多 5），本书标记为已核对。
 * 答错：降到待复习（needsReconfirm），掌握度压到 1 以内，并进入错词本。
 */
export async function recheckHandler(req: Request, res: Response) {
  try {
    const userId = studyOrReply(req, res)
    if (!userId) return
    const { bookCode, wordId, type, isCorrect } = req.body as {
      bookCode?: string
      wordId?: string
      type?: WordType
      isCorrect?: boolean
    }

    if (!bookCode || !wordId || !type || typeof isCorrect !== 'boolean' || !TRAINING_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid request body' })
    }

    await assertBookAccess(userId, bookCode)
    const book = await prisma.book.findUnique({ where: { code: bookCode }, select: { id: true } })
    if (!book) {
      return res.status(404).json({ success: false, error: 'Book not found' })
    }

    const belong = await prisma.bookVocabulary.findUnique({
      where: { bookId_wordId: { bookId: book.id, wordId } },
      select: { wordId: true }
    })
    if (!belong) {
      return res.status(400).json({ success: false, error: 'wordId is not in this book' })
    }

    const result = await practice(userId, { wordId, type, isCorrect })
    const now = new Date()

    const check = await prisma.$transaction(async tx => {
      const stat = await tx.vocabularyStat.findUnique({
        where: { learnerId_wordId_type: { learnerId: userId, wordId, type } }
      })
      if (stat) {
        await tx.vocabularyStat.update({
          where: { id: stat.id },
          data: {
            needsReconfirm: !isCorrect,
            mastery: isCorrect
              ? Math.min(5, stat.mastery + 1)
              : Math.min(stat.mastery, 1)
          }
        })
      }

      if (!isCorrect) {
        await tx.learnerWordMark.upsert({
          where: { learnerId_wordId: { learnerId: userId, wordId } },
          update: { inWrongBook: true, wrongSource: 'word', wrongStreak: 0 },
          create: {
            learnerId: userId,
            wordId,
            inWrongBook: true,
            wrongSource: 'word',
            wrongStreak: 0
          }
        })
      }

      return tx.bookWordCheck.upsert({
        where: { learnerId_bookId_wordId_type: { learnerId: userId, bookId: book.id, wordId, type } },
        update: isCorrect
          ? { passed: true, failStreak: 0, checkedAt: now }
          : { passed: false, failStreak: { increment: 1 }, checkedAt: now },
        create: {
          learnerId: userId,
          bookId: book.id,
          wordId,
          type,
          passed: isCorrect,
          failStreak: isCorrect ? 0 : 1,
          checkedAt: now
        }
      })
    })

    const stat = await prisma.vocabularyStat.findUnique({
      where: { learnerId_wordId_type: { learnerId: userId, wordId, type } },
      select: { mastery: true, needsReconfirm: true }
    })

    res.status(200).json({
      success: true,
      data: {
        ...result,
        mastery: stat?.mastery ?? result.mastery,
        needsReconfirm: stat?.needsReconfirm ?? !isCorrect,
        passed: isCorrect,
        failStreak: check.failStreak
      }
    })
  } catch (error) {
    const message = (error as Error).message
    res.status(message === 'BOOK_LOCKED' ? 403 : 500).json({ success: false, error: message })
  }
}

export async function completeSessionHandler(req: Request, res: Response) {
  try {
    const userId = studyOrReply(req, res)
    if (!userId) return
    const { bookCode, wordIds } = req.body as { bookCode?: string; wordIds?: string[] }

    if (!bookCode || !Array.isArray(wordIds)) {
      return res.status(400).json({ success: false, error: 'bookCode and wordIds are required' })
    }

    const uniqueWordIds = [
      ...new Set(
        wordIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      )
    ]
    if (uniqueWordIds.length === 0) {
      return res.status(400).json({ success: false, error: 'wordIds is empty' })
    }
    if (uniqueWordIds.length > MAX_SESSION_WORDS) {
      return res.status(400).json({
        success: false,
        error: `wordIds exceeds the ${MAX_SESSION_WORDS} limit`
      })
    }

    await assertBookAccess(userId, bookCode)
    const book = await prisma.book.findUnique({ where: { code: bookCode }, select: { id: true } })
    if (!book) {
      return res.status(404).json({ success: false, error: 'Book not found' })
    }

    const rows = await prisma.bookVocabulary.findMany({
      where: { bookId: book.id, wordId: { in: uniqueWordIds } },
      select: { wordId: true }
    })
    if (rows.length !== uniqueWordIds.length) {
      return res.status(400).json({
        success: false,
        error: 'wordIds contain words outside this book'
      })
    }

    const newlyCovered = await getNewlyCoveredCount(userId, bookCode, uniqueWordIds)
    await markWordsPracticed(userId, bookCode, uniqueWordIds)
    await recordDailyStudy(userId, uniqueWordIds.length)

    res.status(200).json({ success: true, data: { newlyCovered }, newlyCovered })
  } catch (error) {
    const message = (error as Error).message
    res.status(message === 'BOOK_LOCKED' ? 403 : 500).json({ success: false, error: message })
  }
}
