import type { NextFunction, Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { asyncHandler } from './async-handler'

function request(): Request {
  return {} as unknown as Request
}

function response(): Response {
  return {} as unknown as Response
}

describe('asyncHandler', () => {
  it('forwards rejected async errors to next', async () => {
    const failure = new Error('boom')
    const next = vi.fn() as NextFunction
    const handler = asyncHandler(async () => {
      throw failure
    })

    handler(request(), response(), next)

    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(failure))
  })

  it('does not call next when the handler resolves', async () => {
    const next = vi.fn() as NextFunction
    const json = vi.fn()
    const handler = asyncHandler(async (_req, res) => {
      res.json({ ok: true })
    })

    handler(request(), { json } as unknown as Response, next)
    await new Promise(resolve => setImmediate(resolve))

    expect(json).toHaveBeenCalledWith({ ok: true })
    expect(next).not.toHaveBeenCalled()
  })
})
