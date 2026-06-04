import { Request, Response } from 'express'
import { getQuizWords, submitQuiz } from '../services/quiz.service'
import { assertBookAccess } from '../services/book-access.service'

export async function getQuizWordsHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const bookCode = req.query.bookCode as string
    const count = parseInt(req.query.count as string) || 30
    if (!bookCode) {
      return res.status(400).json({ success: false, error: 'bookCode required' })
    }
    await assertBookAccess(userId, bookCode)
    const words = await getQuizWords(userId, bookCode, count)
    res.status(200).json({ success: true, data: words })
  } catch (error) {
    const msg = (error as Error).message
    res.status(msg === 'BOOK_LOCKED' ? 403 : 500).json({ success: false, error: msg })
  }
}

export async function submitQuizHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { bookCode, items } = req.body as { bookCode?: string; items?: { wordId: string; isCorrect: boolean }[] }
    if (!bookCode || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Invalid body' })
    }
    await assertBookAccess(userId, bookCode)
    const result = await submitQuiz(userId, bookCode, items)
    res.status(200).json({ success: true, data: result })
  } catch (error) {
    const msg = (error as Error).message
    res.status(msg === 'BOOK_LOCKED' ? 403 : 500).json({ success: false, error: msg })
  }
}
