import { Request, Response, NextFunction } from 'express'
import { log } from '../utils/logger'

export function errorMiddleware(err: Error & { type?: string; status?: number }, req: Request, res: Response, _next: NextFunction) {
  const path = req.originalUrl.split('?')[0]
  const requestId = req.requestId

  if (err.type === 'entity.too.large') {
    log('warn', 'request_error', {
      requestId,
      method: req.method,
      path,
      status: 413,
      error: 'AUDIO_TOO_LARGE'
    })
    return res.status(413).json({ success: false, error: 'AUDIO_TOO_LARGE' })
  }

  const status = err.status || 500
  // 5xx 只暴露通用错误码，避免把 Prisma / 内部实现细节返回给客户端
  if (status >= 500) {
    log('error', 'unhandled_error', {
      requestId,
      method: req.method,
      path,
      status,
      error: err.message,
      stack: err.stack
    })
    return res.status(status).json({ success: false, error: 'INTERNAL_ERROR' })
  }

  log('warn', 'request_error', {
    requestId,
    method: req.method,
    path,
    status,
    error: err.message
  })
  res.status(status).json({ success: false, error: err.message })
}
