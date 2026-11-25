import { describe, expect, it, vi } from 'vitest'
import { requestContext } from './request-context'

function run(headers: Record<string, string> = {}) {
  const req = { headers } as never
  const res = { locals: {} as Record<string, unknown>, setHeader: vi.fn() }
  const next = vi.fn()
  requestContext()(req, res as never, next)
  return { req: req as { requestId?: string }, res, next }
}

describe('requestContext', () => {
  it('generates a request id and exposes it in the response header', () => {
    const { req, res, next } = run()
    expect(next).toHaveBeenCalledOnce()
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId)
    expect(res.locals.requestId).toBe(req.requestId)
  })

  it('reuses a safe incoming request id', () => {
    const { req } = run({ 'x-request-id': 'client-request-123' })
    expect(req.requestId).toBe('client-request-123')
  })

  it('replaces an unsafe incoming request id', () => {
    const { req } = run({ 'x-request-id': 'bad id with spaces' })
    expect(req.requestId).not.toBe('bad id with spaces')
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/)
  })
})
