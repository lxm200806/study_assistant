import type { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rateLimit, resetRateLimitBuckets } from './rate-limit'

function createRequest(ip = '127.0.0.1', userId?: string): Request {
  return {
    ip,
    userId,
    socket: { remoteAddress: ip },
    body: {}
  } as unknown as Request
}

function createResponse() {
  const headers: Record<string, string> = {}
  let statusCode = 200
  let body: unknown

  const res = {
    setHeader(name: string, value: string | number) {
      headers[name] = String(value)
      return res
    },
    status(code: number) {
      statusCode = code
      return res
    },
    json(payload: unknown) {
      body = payload
      return res
    }
  }

  return {
    res: res as unknown as Response,
    headers,
    getStatus: () => statusCode,
    getBody: () => body
  }
}

beforeEach(() => {
  resetRateLimitBuckets()
})

describe('rateLimit', () => {
  it('allows requests up to the limit and rejects the next one', async () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 2, keyPrefix: 'test' })
    const next = vi.fn() as NextFunction

    const first = createResponse()
    await middleware(createRequest(), first.res, next)
    const second = createResponse()
    await middleware(createRequest(), second.res, next)

    expect(next).toHaveBeenCalledTimes(2)
    expect(second.headers['RateLimit-Remaining']).toBe('0')

    const third = createResponse()
    await middleware(createRequest(), third.res, next)
    expect(third.getStatus()).toBe(429)
    expect(third.headers['Retry-After']).toBeDefined()
    expect(next).toHaveBeenCalledTimes(2)
  })

  it('keeps separate buckets per user', async () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: 'user' })
    const next = vi.fn() as NextFunction

    await middleware(createRequest('10.0.0.1', 'user-a'), createResponse().res, next)
    await middleware(createRequest('10.0.0.1', 'user-b'), createResponse().res, next)

    expect(next).toHaveBeenCalledTimes(2)
  })

  it('resets counters after the window expires', async () => {
    vi.useFakeTimers()
    const middleware = rateLimit({ windowMs: 1_000, max: 1, keyPrefix: 'window' })
    const next = vi.fn() as NextFunction

    await middleware(createRequest(), createResponse().res, next)
    const limited = createResponse()
    await middleware(createRequest(), limited.res, next)
    expect(limited.getStatus()).toBe(429)

    vi.advanceTimersByTime(1_001)
    const afterReset = createResponse()
    await middleware(createRequest(), afterReset.res, next)
    expect(afterReset.getStatus()).toBe(200)
    expect(next).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })
})
