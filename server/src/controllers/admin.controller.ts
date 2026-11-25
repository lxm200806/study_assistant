import { Request, Response } from 'express'
import { getMissingMeaningSummary, getMissingMeaningWords } from '../services/admin.service'
import { listAdminAudit } from '../services/audit.service'
import { internalError } from '../utils/http-errors'
import { validatedQuery } from '../validation/validate'
import type { AdminAuditQuery, AdminMissingWordsQuery } from '../validation/schemas'

export async function getMissingSummaryHandler(req: Request, res: Response) {
  try {
    const data = await getMissingMeaningSummary()
    res.status(200).json({ success: true, data })
  } catch (error) {
    internalError(res, error)
  }
}

export async function getAuditHandler(req: Request, res: Response) {
  try {
    const { page, limit } = validatedQuery<AdminAuditQuery>(res)
    const data = await listAdminAudit(page, limit)
    res.status(200).json({ success: true, data })
  } catch (error) {
    internalError(res, error)
  }
}

export async function getMissingWordsHandler(req: Request, res: Response) {
  try {
    const { bookCode, page, limit, issueType } =
      validatedQuery<AdminMissingWordsQuery>(res)

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
