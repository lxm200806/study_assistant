import { Request, Response } from 'express'
import { getBooks, getBookByCode, getBookMetaByCode, getRandomWordsFromBook } from '../services/book.service'
import { getSessionWords, getBookProgress } from '../services/coverage.service'
import { signSessionToken } from '../services/session-token'
import { getDueCount } from '../services/training.service'
import { assertBookAccess } from '../services/book-access.service'
import { formatBookWord, formatWordForClient } from '../utils/wordFormat'
import { internalError } from '../utils/http-errors'
import { validatedQuery } from '../validation/validate'
import type { BookSessionQuery, DueCountQuery, RandomCountQuery } from '../validation/schemas'

export async function getBooksHandler(req: Request, res: Response) {
  try {
    const books = await getBooks()
    res.status(200).json({ success: true, data: books })
  } catch (error) {
    internalError(res, error)
  }
}

export async function getBookDetailHandler(req: Request, res: Response) {
  try {
    const { code } = req.params
    const meta = await getBookMetaByCode(code)
    if (!meta) {
      return res.status(404).json({ success: false, error: 'Book not found' })
    }

    const accessUserId = req.learnerId || req.userId
    if (!accessUserId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    await assertBookAccess(accessUserId, code)

    const book = await getBookByCode(code)

    if (!book) {
      return res.status(404).json({ success: false, error: 'Book not found' })
    }

    const formattedWords = book.vocabulary.map(bv => formatBookWord(bv))

    res.status(200).json({
      success: true,
      data: {
        id: book.id,
        name: book.name,
        code: book.code,
        description: book.description,
        level: book.level,
        wordCount: book.wordCount,
        words: formattedWords
      }
    })
  } catch (error) {
    if ((error as Error).message === 'BOOK_LOCKED') {
      return res.status(403).json({ success: false, error: 'BOOK_LOCKED' })
    }
    internalError(res, error)
  }
}

export async function getRandomWordsFromBookHandler(req: Request, res: Response) {
  try {
    const { code } = req.params
    const { count } = validatedQuery<RandomCountQuery>(res)
    const meta = await getBookMetaByCode(code)
    if (!meta) {
      return res.status(404).json({ success: false, error: 'Book not found' })
    }

    const accessUserId = req.learnerId || req.userId
    if (!accessUserId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    await assertBookAccess(accessUserId, code)

    const words = await getRandomWordsFromBook(code, count)
    const formattedWords = words.map(word => formatWordForClient(word))

    res.status(200).json({ success: true, data: formattedWords })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'BOOK_LOCKED') {
      return res.status(403).json({ success: false, error: 'BOOK_LOCKED' })
    }
    if (message === 'Book not found') {
      return res.status(404).json({ success: false, error: message })
    }
    internalError(res, error)
  }
}

export async function getBookSessionHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    const { code } = req.params
    const query = validatedQuery<BookSessionQuery>(res)
    const count = query.count
    const mode = query.mode
    const type = query.type
    const topic = query.topic
    const unitId = query.unit
    const excludeIds = (query.exclude || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    await assertBookAccess(userId, code)
    const result = await getSessionWords(userId, code, count, mode, type, topic, { unitId, excludeIds })
    // 词表凭证：完成会话时只接受本次下发过的词，防止客户端伪造 wordIds。
    const sessionToken = signSessionToken(
      userId,
      code,
      result.words.map(word => word.id)
    )
    res.status(200).json({ success: true, data: { ...result, sessionToken } })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'BOOK_LOCKED') {
      return res.status(403).json({ success: false, error: '当前词书需开通会员后使用' })
    }
    if (message === 'UNIT_REQUIRED') {
      return res.status(400).json({ success: false, error: '单元学习需指定 unit' })
    }
    if (message === 'Book not found') {
      return res.status(404).json({ success: false, error: message })
    }
    internalError(res, error)
  }
}

export async function getBookProgressHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    const { code } = req.params
    const meta = await getBookMetaByCode(code)
    if (!meta) return res.status(404).json({ success: false, error: 'Book not found' })
    await assertBookAccess(userId, code)
    const progress = await getBookProgress(userId, code)
    res.status(200).json({ success: true, data: progress })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'BOOK_LOCKED') {
      return res.status(403).json({ success: false, error: 'BOOK_LOCKED' })
    }
    if (message === 'Book not found') {
      return res.status(404).json({ success: false, error: message })
    }
    internalError(res, error)
  }
}

export async function getBookDueCountHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    const { code } = req.params
    const meta = await getBookMetaByCode(code)
    if (!meta) return res.status(404).json({ success: false, error: 'Book not found' })
    await assertBookAccess(userId, code)
    const { type } = validatedQuery<DueCountQuery>(res)
    const counts = await getDueCount(userId, code, type)
    res.status(200).json({ success: true, data: counts })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'BOOK_LOCKED') {
      return res.status(403).json({ success: false, error: 'BOOK_LOCKED' })
    }
    if (message === 'Book not found') {
      return res.status(404).json({ success: false, error: message })
    }
    internalError(res, error)
  }
}
