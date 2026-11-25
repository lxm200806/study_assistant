import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { validateBody, validateQuery, validatedQuery } from './validate'

function createResponse() {
  const res = {
    locals: {} as Record<string, unknown>,
    status: vi.fn(),
    json: vi.fn()
  }
  res.status.mockReturnValue(res)
  res.json.mockReturnValue(res)
  return res
}

describe('validation middleware', () => {
  it('replaces the body with parsed data', () => {
    const req = { body: { count: '3' } } as never
    const res = createResponse()
    const next = vi.fn()

    validateBody(z.object({ count: z.coerce.number().int() }))(req, res as never, next)

    expect(next).toHaveBeenCalledOnce()
    expect((req as { body: { count: number } }).body.count).toBe(3)
  })

  it('returns a consistent 400 for invalid bodies', () => {
    const req = { body: {} } as never
    const res = createResponse()
    const next = vi.fn()

    validateBody(z.object({ name: z.string().min(1) }))(req, res as never, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, code: 'INVALID_REQUEST' })
    )
  })

  it('stores parsed query in res.locals', () => {
    const req = { query: { count: '5', mode: 'smart' } } as never
    const res = createResponse()
    const next = vi.fn()
    const schema = z.object({
      count: z.coerce.number().int(),
      mode: z.enum(['smart', 'coverage'])
    })

    validateQuery(schema)(req, res as never, next)

    expect(next).toHaveBeenCalledOnce()
    expect(validatedQuery<z.infer<typeof schema>>(res as never)).toEqual({
      count: 5,
      mode: 'smart'
    })
  })
})
