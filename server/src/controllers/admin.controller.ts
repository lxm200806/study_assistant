import { Request, Response } from 'express'
import { getMissingMeaningSummary, getMissingMeaningWords } from '../services/admin.service'
import { internalError } from '../utils/http-errors'

export async function getMissingSummaryHandler(req: Request, res: Response) {
  try {
    const data = await getMissingMeaningSummary()
    res.status(200).json({ success: true, data })
  } catch (error) {
    internalError(res, error)
  }
}

export async function getMissingWordsHandler(req: Request, res: Response) {
  try {
    const bookCode = req.query.bookCode as string | undefined
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50
    const issueType = req.query.issueType as 'missing_cn' | 'parse_error' | undefined

    const data = await getMissingMeaningWords(bookCode, page, limit, issueType)
    res.status(200).json({ success: true, data })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'Book not found') {
      return res.status(404).json({ success: false, error: message })
    }
    internalError(res, error)
  }
}
