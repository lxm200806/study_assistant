import { describe, expect, it } from 'vitest'
import { pickSmartQueue, stableUnit, type SmartQueueCandidate } from './smart-queue'

function candidate(partial: Partial<SmartQueueCandidate> & Pick<SmartQueueCandidate, 'id'>): SmartQueueCandidate {
  return {
    order: 0,
    score: 0,
    isNew: false,
    due: false,
    weak: false,
    recentWrong: false,
    lapses: 0,
    ...partial
  }
}

describe('smart queue quotas', () => {
  it('caps new words at 30% and keeps due/weak words at half or more', () => {
    const candidates = [
      ...Array.from({ length: 20 }, (_, i) => candidate({ id: `new-${i}`, order: i, isNew: true, score: 1000 - i })),
      ...Array.from({ length: 20 }, (_, i) =>
        candidate({ id: `weak-${i}`, order: i, weak: true, due: i % 2 === 0, score: 900 - i })
      ),
      ...Array.from({ length: 10 }, (_, i) => candidate({ id: `rest-${i}`, order: i, score: 100 - i }))
    ]

    const picked = pickSmartQueue(candidates, { count: 10, dailyNewRemaining: 20 })
    const newCount = picked.filter(id => id.startsWith('new-')).length
    const weakCount = picked.filter(id => id.startsWith('weak-')).length
    expect(picked).toHaveLength(10)
    expect(newCount).toBeLessThanOrEqual(3)
    expect(weakCount).toBeGreaterThanOrEqual(5)
  })

  it('respects the remaining daily new-word allowance', () => {
    const candidates = [
      ...Array.from({ length: 10 }, (_, i) => candidate({ id: `new-${i}`, order: i, isNew: true, score: 1000 })),
      ...Array.from({ length: 10 }, (_, i) => candidate({ id: `weak-${i}`, order: i, weak: true, score: 10 }))
    ]
    const picked = pickSmartQueue(candidates, { count: 10, dailyNewRemaining: 0 })
    expect(picked.filter(id => id.startsWith('new-'))).toHaveLength(0)
    expect(picked).toHaveLength(10)
  })

  it('never exceeds the daily allowance when the pool is all new words', () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      candidate({ id: `new-${i}`, order: i, isNew: true, score: 1000 - i })
    )
    const picked = pickSmartQueue(candidates, { count: 10, dailyNewRemaining: 4 })
    expect(picked).toHaveLength(4)
  })

  it('limits leeches and recent wrong words', () => {
    const candidates = [
      ...Array.from({ length: 10 }, (_, i) =>
        candidate({ id: `wrong-${i}`, order: i, weak: true, recentWrong: true, lapses: 5, score: 1000 - i })
      ),
      ...Array.from({ length: 10 }, (_, i) => candidate({ id: `due-${i}`, order: i, weak: true, score: 900 - i }))
    ]
    const picked = pickSmartQueue(candidates, { count: 10, dailyNewRemaining: 0 })
    expect(picked.filter(id => id.startsWith('wrong-')).length).toBeLessThanOrEqual(2)
  })

  it('keeps the daily jitter stable within a day', () => {
    expect(stableUnit('2026-11-25:user:word')).toBe(stableUnit('2026-11-25:user:word'))
    expect(stableUnit('2026-11-25:user:word')).not.toBe(stableUnit('2026-11-26:user:word'))
  })
})
