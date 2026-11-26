import type { Request, Response } from 'express'
import { getEntitlements } from '../entitlements/entitlement.service'
import { internalError } from '../utils/http-errors'

export async function getEntitlementsHandler(req: Request, res: Response) {
  try {
    const data = await getEntitlements(req.userId!)
    res.status(200).json({ success: true, data })
  } catch (error) {
    internalError(res, error)
  }
}
