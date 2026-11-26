import type { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test_jwt_secret_that_is_longer_than_32_chars'
  delete process.env.JWT_REFRESH_SECRET
})

const prismaMock = vi.hoisted(() => ({
  authSession: { findFirst: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  learner: { findFirst: vi.fn() },
  accountDailyActive: { upsert: vi.fn() }
}))

const kvMock = vi.hoisted(() => ({
  kvIncrWindow: vi.fn()
}))

vi.mock('../prisma/client', () => ({ default: prismaMock }))
vi.mock('../services/kv.service', () => kvMock)

import { generateAccessToken } from '../utils/jwt'
import { authMiddleware } from './auth'

function request(token?: string): Request {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {}
  } as unknown as Request
}

function response() {
  let statusCode = 200
  let body: unknown

  const res = {
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
    getStatus: () => statusCode,
    getBody: () => body
  }
}

async function invoke(req: Request) {
  const res = response()
  const next = vi.fn()
  authMiddleware(req, res.res, next as unknown as NextFunction)

  await vi.waitFor(() => {
    if (next.mock.calls.length === 0 && res.getBody() === undefined) {
      throw new Error('auth middleware still pending')
    }
  })

  return { res, next }
}

function userWithLearner(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    tokenVersion: 1,
    activeLearner: { id: 'l1', accountId: 'u1', archivedAt: null },
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  kvMock.kvIncrWindow.mockResolvedValue({ count: 2, resetAt: 0 })
  prismaMock.user.update.mockResolvedValue({})
  prismaMock.accountDailyActive.upsert.mockResolvedValue({})
})

describe('authMiddleware', () => {
  it('rejects requests without a bearer token', async () => {
    const { res, next } = await invoke(request())

    expect(next).not.toHaveBeenCalled()
    expect(res.getStatus()).toBe(401)
    expect(res.getBody()).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('authenticates with one session query and resolves the active learner', async () => {
    prismaMock.authSession.findFirst.mockResolvedValue({
      id: 's1',
      user: userWithLearner()
    })

    const req = request(generateAccessToken('u1', 'alice', 1, 's1'))
    const { next } = await invoke(req)

    expect(next).toHaveBeenCalledTimes(1)
    expect(req.userId).toBe('u1')
    expect(req.sessionId).toBe('s1')
    expect(req.learnerId).toBe('l1')
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.learner.findFirst).not.toHaveBeenCalled()
  })

  it('rejects a revoked device session', async () => {
    prismaMock.authSession.findFirst.mockResolvedValue(null)

    const { res, next } = await invoke(request(generateAccessToken('u1', 'alice', 1, 's1')))

    expect(next).not.toHaveBeenCalled()
    expect(res.getStatus()).toBe(401)
    expect(res.getBody()).toMatchObject({ code: 'SESSION_REVOKED' })
  })

  it('rejects a token whose account version is stale', async () => {
    prismaMock.authSession.findFirst.mockResolvedValue({
      id: 's1',
      user: userWithLearner({ tokenVersion: 2 })
    })

    const { res, next } = await invoke(request(generateAccessToken('u1', 'alice', 1, 's1')))

    expect(next).not.toHaveBeenCalled()
    expect(res.getStatus()).toBe(401)
    expect(res.getBody()).toMatchObject({ code: 'SESSION_REVOKED' })
  })

  it('falls back to the first learner when the active learner is unavailable', async () => {
    prismaMock.authSession.findFirst.mockResolvedValue({
      id: 's1',
      user: userWithLearner({ activeLearner: null })
    })
    prismaMock.learner.findFirst.mockResolvedValue({ id: 'l2' })

    const req = request(generateAccessToken('u1', 'alice', 1, 's1'))
    const { next } = await invoke(req)

    expect(next).toHaveBeenCalledTimes(1)
    expect(req.learnerId).toBe('l2')
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { activeLearnerId: 'l2' }
    })
  })

  it('supports legacy tokens without a sid', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userWithLearner())

    const req = request(generateAccessToken('u1', 'alice', 1))
    const { next } = await invoke(req)

    expect(next).toHaveBeenCalledTimes(1)
    expect(req.learnerId).toBe('l1')
    expect(req.sessionId).toBeUndefined()
    expect(prismaMock.authSession.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.learner.findFirst).not.toHaveBeenCalled()
  })

  it('writes the daily active row only when the throttle allows it', async () => {
    prismaMock.authSession.findFirst.mockResolvedValue({
      id: 's1',
      user: userWithLearner()
    })
    kvMock.kvIncrWindow.mockResolvedValue({ count: 1, resetAt: 0 })

    const { next } = await invoke(request(generateAccessToken('u1', 'alice', 1, 's1')))

    expect(next).toHaveBeenCalledTimes(1)
    await vi.waitFor(() =>
      expect(prismaMock.accountDailyActive.upsert).toHaveBeenCalledTimes(1)
    )
    expect(kvMock.kvIncrWindow).toHaveBeenCalledWith(
      expect.stringMatching(/^dau:u1:/),
      24 * 60 * 60 * 1000
    )
  })
})
