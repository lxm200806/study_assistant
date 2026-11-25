import { beforeEach, describe, expect, it, vi } from 'vitest'
import { kvDelete, kvGet, kvIncrWindow, kvSet, redisEnabled, resetKvMemory } from './kv.service'

beforeEach(() => {
  resetKvMemory()
})

describe('kv service (memory fallback)', () => {
  it('uses memory when REDIS_URL is absent', () => {
    expect(redisEnabled).toBe(false)
  })

  it('increments a fixed window', async () => {
    const first = await kvIncrWindow('test:key', 1_000)
    const second = await kvIncrWindow('test:key', 1_000)
    expect(first.count).toBe(1)
    expect(second.count).toBe(2)
    expect(second.resetAt).toBe(first.resetAt)
  })

  it('stores, reads and deletes JSON values', async () => {
    await kvSet('json:key', { a: 1 }, 1_000)
    expect(await kvGet<{ a: number }>('json:key')).toEqual({ a: 1 })
    await kvDelete('json:key')
    expect(await kvGet('json:key')).toBeNull()
  })

  it('expires values', async () => {
    vi.useFakeTimers()
    await kvSet('expire:key', 'value', 100)
    expect(await kvGet('expire:key')).toBe('value')
    vi.advanceTimersByTime(101)
    expect(await kvGet('expire:key')).toBeNull()
    vi.useRealTimers()
  })
})
