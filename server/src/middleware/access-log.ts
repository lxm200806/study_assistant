import type { RequestHandler } from 'express'
import { log } from '../utils/logger'

const SKIP_PATHS = new Set(['/health', '/ready'])

/** 记录请求方法、路径、状态和耗时；健康检查与 Swagger 静态资源不记录。 */
export function accessLog(): RequestHandler {
  return (req, res, next) => {
    if (req.method === 'OPTIONS' || SKIP_PATHS.has(req.path) || req.path.startsWith('/api-docs')) {
      next()
      return
    }

    const startedAt = process.hrtime.bigint()
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
      const status = res.statusCode
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
      log(level, 'http_request', {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status,
        durationMs: Math.round(durationMs * 10) / 10,
        userId: req.userId,
        learnerId: req.learnerId
      })
    })

    next()
  }
}
