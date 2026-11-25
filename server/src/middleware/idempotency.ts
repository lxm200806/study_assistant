import type { RequestHandler, Response } from 'express'
import { apiErrorBody } from '../utils/api-response'
import { kvGet, kvSet, resetKvMemory } from '../services/kv.service'

interface CachedResponse {
  expiresAt: number
  status: number
  body: unknown
}

const TTL_MS = 10 * 60 * 1000

/**
 * 可选幂等：客户端带 `Idempotency-Key` 时缓存 2xx 响应 10 分钟。
 * 配置 REDIS_URL 时多实例共享，否则进程内缓存。
 */
export function idempotency(): RequestHandler {
  return async (req, res, next) => {
    const raw = req.headers['idempotency-key']
    const value = Array.isArray(raw) ? raw[0] : raw
    if (!value) {
      next()
      return
    }
    if (typeof value !== 'string' || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
      res.status(400).json(apiErrorBody('Invalid Idempotency-Key', 'INVALID_IDEMPOTENCY_KEY'))
      return
    }

    const now = Date.now()
    const key = `${req.learnerId || req.userId || 'anonymous'}:${req.method}:${req.originalUrl}:${value}`
    const cached = await kvGet<CachedResponse>(key)
    if (cached && cached.expiresAt > now) {
      res.setHeader('Idempotency-Replayed', 'true')
      res.status(cached.status).json(cached.body)
      return
    }

    const originalJson = res.json.bind(res)
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void kvSet(key, { expiresAt: now + TTL_MS, status: res.statusCode, body }, TTL_MS)
      }
      return originalJson(body)
    }) as Response['json']

    next()
  }
}

/** 仅测试/运维需要时使用。 */
export function resetIdempotencyStore(): void {
  resetKvMemory()
}
