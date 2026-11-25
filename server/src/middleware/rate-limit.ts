import type { Request, RequestHandler } from 'express'
import { apiErrorBody } from '../utils/api-response'

export interface RateLimitOptions {
  windowMs: number
  max: number
  keyPrefix: string
  message?: string
  key?: (req: Request) => string
}

interface Bucket {
  count: number
  resetAt: number
}

const MAX_BUCKETS = 10_000
const buckets = new Map<string, Bucket>()

function defaultKey(req: Request): string {
  return req.userId || req.ip || req.socket.remoteAddress || 'unknown'
}

export function resetRateLimitBuckets(): void {
  buckets.clear()
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const now = Date.now()
    const key = `${options.keyPrefix}:${options.key ? options.key(req) : defaultKey(req)}`
    let bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs }
      buckets.set(key, bucket)
    }
    bucket.count += 1

    if (buckets.size > MAX_BUCKETS) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey)
      }
      while (buckets.size > MAX_BUCKETS) {
        const oldest = buckets.keys().next().value
        if (oldest === undefined) break
        buckets.delete(oldest)
      }
    }

    const remaining = Math.max(0, options.max - bucket.count)
    res.setHeader('RateLimit-Limit', String(options.max))
    res.setHeader('RateLimit-Remaining', String(remaining))
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))

    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))))
      res
        .status(429)
        .json(apiErrorBody(options.message || 'Too many requests, please try again later', 'RATE_LIMITED'))
      return
    }

    next()
  }
}
