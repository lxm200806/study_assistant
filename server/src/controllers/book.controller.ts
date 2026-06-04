import { Request, Response } from 'express'
import { getBooks, getBookByCode, getRandomWordsFromBook } from '../services/book.service'
import { getSessionWords, getBookProgress, type SessionMode } from '../services/coverage.service'
import { getDueCount } from '../services/training.service'
import { assertBookAccess } from '../services/book-access.service'
import { formatWordForClient } from '../utils/wordFormat'

export async function getBooksHandler(req: Request, res: Response) {
  try {
    const books = await getBooks()
    res.status(200).json({ success: true, data: books })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getBookDetailHandler(req: Request, res: Response) {
  try {
    const { code } = req.params
    const book = await getBookByCode(code)

    if (!book) {
      return res.status(404).json({ success: false, error: 'Book not found' })
    }

    const formattedWords = book.vocabulary.map(bv => formatWordForClient(bv.word))

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
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getRandomWordsFromBookHandler(req: Request, res: Response) {
  try {
    const { code } = req.params
    const count = parseInt(req.query.count as string) || 10

    const words = await getRandomWordsFromBook(code, count)
    const formattedWords = words.map(word => formatWordForClient(word))

    res.status(200).json({ success: true, data: formattedWords })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getBookSessionHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { code } = req.params
    const count = parseInt(req.query.count as string) || 10
    const mode = (req.query.mode as SessionMode) || 'coverage'
    const type = req.query.type as string | undefined
    const topic = req.query.topic as string | undefined

    await assertBookAccess(userId, code)
    const result = await getSessionWords(userId, code, count, mode, type, topic)
    res.status(200).json({ success: true, data: result })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'BOOK_LOCKED') {
      return res.status(403).json({ success: false, error: '当前词书需开通会员后使用' })
    }
    if (message === 'Book not found') {
      return res.status(404).json({ success: false, error: message })
    }
    res.status(500).json({ success: false, error: message })
  }
}

export async function getBookProgressHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { code } = req.params
    const progress = await getBookProgress(userId, code)
    res.status(200).json({ success: true, data: progress })
  } catch (error) {
    const message = (error as Error).message
    res.status(message === 'Book not found' ? 404 : 500).json({ success: false, error: message })
  }
}

export async function getBookDueCountHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { code } = req.params
    const type = req.query.type as import('../types').WordType | undefined
    const counts = await getDueCount(userId, code, type)
    res.status(200).json({ success: true, data: counts })
  } catch (error) {
    const message = (error as Error).message
    res.status(message === 'Book not found' ? 404 : 500).json({ success: false, error: message })
  }
}
