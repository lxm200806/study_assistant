import { describe, expect, it } from 'vitest'
import { unwrapStorage } from './storage'

describe('unwrapStorage', () => {
  it('returns null for empty values', () => {
    expect(unwrapStorage(null)).toBeNull()
    expect(unwrapStorage('')).toBeNull()
    expect(unwrapStorage(undefined)).toBeNull()
  })

  it('unwraps the uni object envelope', () => {
    expect(unwrapStorage({ type: 'object', data: { a: 1 } })).toEqual({ a: 1 })
  })

  it('returns primitive storage values as-is', () => {
    expect(unwrapStorage('token')).toBe('token')
    expect(unwrapStorage(42)).toBe(42)
  })
})
