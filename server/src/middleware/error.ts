import { Request, Response, NextFunction } from 'express'

export function errorMiddleware(err: Error & { type?: string; status?: number }, req: Request, res: Response, _next: NextFunction) {
  console.error(err.stack || err.message)

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'AUDIO_TOO_LARGE' })
  }

  const status = err.status || 500
  // 5xx 只暴露通用错误码，避免把 Prisma / 内部实现细节返回给客户端
  if (status >= 500) {
    return res.status(status).json({ success: false, error: 'INTERNAL_ERROR' })
  }
  res.status(status).json({ success: false, error: err.message })
}
