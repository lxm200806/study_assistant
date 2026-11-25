import type { Request, RequestHandler } from 'express'
import { apiErrorBody } from '../utils/api-response'
import { kvIncrWindow, resetKvMemory } from '../services/kv.service'

export interface RateLimitOptions {
  windowMs: number
  max: number
  keyPrefix: string
  message?: string
  key?: (req: Request) => string
}

function defaultKey(req: Request): string {
  return req.userId || req.ip || req.socket.remoteAddress || 'unknown'
}

export function resetRateLimitBuckets(): void {
  resetKvMemory()
}

/**
 * 固定窗口限流。配置 REDIS_URL 时使用 Redis，否则进程内 Map。
 * 多实例部署必须配置 Redis，否则每个实例各自计数。
 */
export function rateLimit(options: RateLimitOptions): RequestHandler {
  return async (req, res, next) => {
    const key = `${options.keyPrefix}:${options.key ? options.key(req) : defaultKey(req)}`
    const { count, resetAt } = await kvIncrWindow(key, options.windowMs)
    const remaining = Math.max(0, options.max - count)

    res.setHeader('RateLimit-Limit', String(options.max))
    res.setHeader('RateLimit-Remaining', String(remaining))
    res.setHeader('RateLimit-Reset', String(Math.ceil(resetAt / 1000)))

    if (count > options.max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))))
      res
        .status(429)
        .json(apiErrorBody(options.message || 'Too many requests, please try again later', 'RATE_LIMITED'))
      return
    }
    next()
  }
}
