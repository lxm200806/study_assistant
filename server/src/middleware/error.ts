import { Request, Response, NextFunction } from 'express'

export function errorMiddleware(err: Error & { type?: string; status?: number }, req: Request, res: Response, _next: NextFunction) {
  console.error(err.stack || err.message)

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'AUDIO_TOO_LARGE' })
  }

  res.status(err.status || 500).json({ success: false, error: err.message })
}