import { beforeAll, describe, expect, it } from 'vitest'
import {
  SESSION_TOKEN_TTL_MS,
  signSessionToken,
  verifySessionToken
} from './session-token'

const TEST_SECRET = 'test_jwt_secret_that_is_longer_than_32_chars'

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET
})

describe('session token', () => {
  it('round-trips learner, book and word ids', () => {
    const now = 1_700_000_000_000
    const token = signSessionToken('learner-1', 'pep-g3a-2024', ['w1', 'w2', 'w1'], now)
    const payload = verifySessionToken(token, now)

    expect(payload.learnerId).toBe('learner-1')
    expect(payload.bookCode).toBe('pep-g3a-2024')
    expect(payload.wordIds).toEqual(['w1', 'w2'])
    expect(payload.exp).toBe(now + SESSION_TOKEN_TTL_MS)
  })

  it('rejects a tampered payload', () => {
    const token = signSessionToken('learner-1', 'pep-g3a-2024', ['w1'])
    const [version, body, signature] = token.split('.')
    const forged = Buffer.from(
      JSON.stringify({ learnerId: 'learner-1', bookCode: 'pep-g3a-2024', wordIds: ['w1', 'w2'], exp: Date.now() + 1000 })
    ).toString('base64url')

    expect(() => verifySessionToken(`${version}.${forged}.${signature}`)).toThrow(
      'SESSION_TOKEN_INVALID'
    )
    expect(() => verifySessionToken(`${version}.${body}.forged`)).toThrow('SESSION_TOKEN_INVALID')
    expect(() => verifySessionToken(token.replace(version, 'v2'))).toThrow('SESSION_TOKEN_INVALID')
  })

  it('rejects expired tokens', () => {
    const now = 1_700_000_000_000
    const token = signSessionToken('learner-1', 'pep-g3a-2024', ['w1'], now)

    expect(() => verifySessionToken(token, now + SESSION_TOKEN_TTL_MS + 1)).toThrow(
      'SESSION_TOKEN_EXPIRED'
    )
  })

  it('caps the word list at 200 entries', () => {
    const wordIds = Array.from({ length: 250 }, (_, index) => `w${index}`)
    const token = signSessionToken('learner-1', 'pep-g3a-2024', wordIds)
    const payload = verifySessionToken(token)

    expect(payload.wordIds).toHaveLength(200)
  })

  it('rejects malformed tokens', () => {
    expect(() => verifySessionToken('')).toThrow('SESSION_TOKEN_INVALID')
    expect(() => verifySessionToken('v1.only-two-parts')).toThrow('SESSION_TOKEN_INVALID')
    expect(() => verifySessionToken('x'.repeat(20_000))).toThrow('SESSION_TOKEN_INVALID')
  })
})
