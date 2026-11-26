import request from 'supertest'
import { afterAll, describe, expect, it, vi } from 'vitest'

describe('createApp', () => {
  afterAll(() => vi.unstubAllEnvs())

  it('returns a JSON 404 envelope for unknown routes', async () => {
    vi.stubEnv('JWT_SECRET', 'test_secret_at_least_32_characters_long')
    const { createApp } = await import('./app')

    const res = await request(createApp()).get('/api/definitely-not-a-route')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      success: false,
      error: 'Not found',
      code: 'NOT_FOUND'
    })
  })
})
