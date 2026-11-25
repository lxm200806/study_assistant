import type { RequestHandler, Response } from 'express'
import { apiErrorBody } from '../utils/api-response'

interface CachedResponse {
  expiresAt: number
  status: number
  body: unknown
}

const TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 5_000
const cache = new Map<string, CachedResponse>()

function prune(now: number) {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key)
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

/**
 * 可选幂等：客户端带 `Idempotency-Key` 时缓存 2xx 响应 10 分钟。
 * 仅适用于单实例；多实例部署时需换成 Redis 等共享存储。
 */
export function idempotency(): RequestHandler {
  return (req, res, next) => {
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
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now) {
      res.setHeader('Idempotency-Replayed', 'true')
      res.status(cached.status).json(cached.body)
      return
    }

    const originalJson = res.json.bind(res)
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, { expiresAt: now + TTL_MS, status: res.statusCode, body })
        prune(now)
      }
      return originalJson(body)
    }) as Response['json']

    next()
  }
}

/** 仅测试/运维需要时使用。 */
export function resetIdempotencyStore(): void {
  cache.clear()
}
