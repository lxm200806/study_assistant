import { describe, expect, it } from 'vitest'
import { clampInt } from './pagination'

describe('clampInt', () => {
  it('uses the fallback for missing or invalid values', () => {
    expect(clampInt(undefined, 20, 1, 50)).toBe(20)
    expect(clampInt('abc', 20, 1, 50)).toBe(20)
    expect(clampInt('', 20, 1, 50)).toBe(20)
  })

  it('clamps values into the allowed range', () => {
    expect(clampInt('0', 20, 1, 50)).toBe(1)
    expect(clampInt('-5', 20, 1, 50)).toBe(1)
    expect(clampInt('999', 20, 1, 50)).toBe(50)
  })

  it('parses numbers and array query values', () => {
    expect(clampInt('12', 20, 1, 50)).toBe(12)
    expect(clampInt(7, 20, 1, 50)).toBe(7)
    expect(clampInt(['8', '9'], 20, 1, 50)).toBe(8)
  })
})
