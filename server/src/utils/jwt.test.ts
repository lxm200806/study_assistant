import jwt from 'jsonwebtoken'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from './jwt'

const TEST_SECRET = 'test_jwt_secret_that_is_longer_than_32_chars'

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET
  delete process.env.JWT_REFRESH_SECRET
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('jwt token types', () => {
  it('accepts access tokens only as access tokens', () => {
    const token = generateAccessToken('user-1', 'alice')

    expect(verifyAccessToken(token)?.userId).toBe('user-1')
    expect(verifyRefreshToken(token)).toBeNull()
  })

  it('accepts refresh tokens only as refresh tokens', () => {
    const token = generateRefreshToken('user-1')

    expect(verifyRefreshToken(token)?.userId).toBe('user-1')
    expect(verifyAccessToken(token)).toBeNull()
  })

  it('rejects legacy tokens that have no token type', () => {
    const legacy = jwt.sign({ userId: 'user-1' }, TEST_SECRET, { expiresIn: '1h' })

    expect(verifyAccessToken(legacy)).toBeNull()
    expect(verifyRefreshToken(legacy)).toBeNull()
  })

  it('rejects missing or placeholder secrets', async () => {
    vi.stubEnv('JWT_SECRET', '')
    vi.resetModules()
    const missing = await import('../config/env')
    expect(() => missing.getJwtAccessSecret()).toThrow(/JWT_SECRET/)

    vi.stubEnv('JWT_SECRET', 'your_jwt_secret_key_here_must_be_at_least_32_characters_long')
    vi.resetModules()
    const weak = await import('../config/env')
    expect(() => weak.getJwtAccessSecret()).toThrow(/JWT_SECRET/)
  })
})
