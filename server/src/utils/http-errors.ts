import { Response } from 'express'

/**
 * Log the underlying failure but never leak Prisma / internal details to clients.
 * Business errors should be mapped to an explicit 4xx response before reaching here.
 */
export function internalError(res: Response, error: unknown) {
  console.error('[api] unhandled error:', error)
  return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' })
}
