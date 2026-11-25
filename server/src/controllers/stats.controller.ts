import { Request, Response } from 'express'
import { getBookMap, getGlobalMap, getBookWordStats } from '../services/graph.service'
import { getBookMetaByCode } from '../services/book.service'
import { assertBookAccess, getBookAccessScope } from '../services/book-access.service'
import { internalError } from '../utils/http-errors'
import { validatedQuery } from '../validation/validate'
import type { BookMapQuery, GlobalMapQuery } from '../validation/schemas'

export async function getBookMapHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    const { code } = req.params
    const { type: trainingType } = validatedQuery<BookMapQuery>(res)

    const meta = await getBookMetaByCode(code)
    if (!meta) return res.status(404).json({ success: false, error: 'Book not found' })
    await assertBookAccess(userId, code)

    const data = trainingType
      ? await getBookWordStats(userId, code, trainingType)
      : await getBookMap(userId, code)

    res.status(200).json({ success: true, data })
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

export async function getGlobalMapHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    // Global atlas = all books' unique words; allow a large page for desktop 图鉴
    const { limit } = validatedQuery<GlobalMapQuery>(res)
    const scope = await getBookAccessScope(userId)
    const data = await getGlobalMap(userId, limit, scope.all ? undefined : scope.codes)
    res.status(200).json({ success: true, data })
  } catch (error) {
    internalError(res, error)
  }
}
