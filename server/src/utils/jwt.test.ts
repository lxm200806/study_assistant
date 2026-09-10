import { describe, expect, it } from 'vitest'
import { generateAccessToken, generateRefreshToken, verifyToken } from './jwt'

describe('jwt token types', () => {
  it('accepts access tokens for access verification', () => {
    const token = generateAccessToken('user-1', 'alice')
    const decoded = verifyToken(token, 'access')
    expect(decoded?.userId).toBe('user-1')
    expect(decoded?.username).toBe('alice')
  })

  it('rejects access tokens when a refresh token is required', () => {
    const token = generateAccessToken('user-1', 'alice')
    expect(verifyToken(token, 'refresh')).toBeNull()
  })

  it('rejects refresh tokens when an access token is required', () => {
    const token = generateRefreshToken('user-1')
    expect(verifyToken(token, 'access')).toBeNull()
  })

  it('still verifies untyped legacy tokens', () => {
    const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken')
    const legacy = jwt.sign(
      { userId: 'legacy-user' },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here_must_be_at_least_32_characters_long'
    )
    expect(verifyToken(legacy, 'refresh')?.userId).toBe('legacy-user')
  })
})
