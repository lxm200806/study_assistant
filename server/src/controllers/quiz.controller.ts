import { Request, Response } from 'express'
import { getQuizWords, submitQuiz } from '../services/quiz.service'
import { assertBookAccess } from '../services/book-access.service'
import { internalError } from '../utils/http-errors'
import { validatedQuery } from '../validation/validate'
import type { QuizSubmitBody, QuizWordsQuery } from '../validation/schemas'

export async function getQuizWordsHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    const { bookCode, count } = validatedQuery<QuizWordsQuery>(res)
    await assertBookAccess(userId, bookCode)
    const words = await getQuizWords(userId, bookCode, count)
    res.status(200).json({ success: true, data: words })
  } catch (error) {
    const msg = (error as Error).message
    if (msg === 'BOOK_LOCKED') {
      return res.status(403).json({ success: false, error: 'BOOK_LOCKED' })
    }
    internalError(res, error)
  }
}

export async function submitQuizHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    const { bookCode, items } = req.body as QuizSubmitBody
    await assertBookAccess(userId, bookCode)
    const result = await submitQuiz(userId, bookCode, items)
    res.status(200).json({ success: true, data: result })
  } catch (error) {
    const msg = (error as Error).message
    if (msg === 'BOOK_LOCKED') {
      return res.status(403).json({ success: false, error: 'BOOK_LOCKED' })
    }
    internalError(res, error)
  }
}
