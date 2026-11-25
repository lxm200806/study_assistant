import { describe, expect, it } from 'vitest'
import { addDaysToKey, startOfToday, todayKey } from './date-key'

describe('app date key', () => {
  it('uses Asia/Shanghai across the local midnight boundary', () => {
    expect(todayKey(new Date('2026-01-01T15:59:00Z'))).toBe('2026-01-01')
    expect(todayKey(new Date('2026-01-01T16:01:00Z'))).toBe('2026-01-02')
  })

  it('keeps the 00:01 and 07:59 local times on the same new day', () => {
    expect(todayKey(new Date('2026-01-01T16:01:00Z'))).toBe('2026-01-02')
    expect(todayKey(new Date('2026-01-01T23:59:00Z'))).toBe('2026-01-02')
  })

  it('starts the quota day at local midnight', () => {
    expect(startOfToday(new Date('2026-01-01T16:30:00Z')).toISOString()).toBe('2026-01-01T16:00:00.000Z')
    expect(startOfToday(new Date('2026-01-01T15:59:00Z')).toISOString()).toBe('2025-12-31T16:00:00.000Z')
  })

  it('adds days across month boundaries', () => {
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
  })
})
