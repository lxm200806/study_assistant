import { afterEach, describe, expect, it, vi } from 'vitest'
import { TtlCache } from './ttl-cache'

afterEach(() => vi.useRealTimers())

describe('TtlCache', () => {
  it('returns values before expiry and null after', () => {
    vi.useFakeTimers()
    const cache = new TtlCache<string, number>(100)
    cache.set('a', 1)
    expect(cache.get('a')).toBe(1)
    vi.advanceTimersByTime(101)
    expect(cache.get('a')).toBeNull()
  })

  it('evicts the oldest entry at capacity', () => {
    const cache = new TtlCache<string, number>(1_000, 2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.get('a')).toBeNull()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
  })
})
