import { describe, it, expect } from 'vitest'
import {
  processPractice,
  getMasteryStatus,
  getWeakReason,
  buildFsrsFieldsFromStat,
  replayPracticeHistory,
  MIN_REPS_FOR_MASTERED
} from './review-engine.service'

describe('review-engine', () => {
  it('first correct answer stays low mastery and enters learning', () => {
    const result = processPractice({ practiceCount: 0, correctCount: 0 }, true)
    expect(result.reps).toBeGreaterThanOrEqual(1)
    expect(result.mastery).toBeLessThanOrEqual(2)
    expect(getMasteryStatus(result)).not.toBe('mastered')
  })

  it('first wrong answer records lapse and weak reason', () => {
    const result = processPractice({ practiceCount: 0, correctCount: 0 }, false)
    expect(result.practiceCount).toBe(1)
    expect(result.recentLapse).toBe(true)
    expect(getWeakReason(result)).toBe('recent_lapse')
    expect(['Learning', 'Relearning']).toContain(result.fsrsState)
  })

  it('three consecutive correct answers can reach mastered after intervals', () => {
    const now = new Date('2026-01-01T10:00:00Z')
    let stat = processPractice({ practiceCount: 0, correctCount: 0 }, true, now)
    stat = processPractice(stat, true, new Date('2026-01-01T10:20:00Z'))
    stat = processPractice(stat, true, new Date('2026-01-02T10:00:00Z'))

    expect(stat.reps).toBeGreaterThanOrEqual(MIN_REPS_FOR_MASTERED)
    const status = getMasteryStatus(stat, new Date('2026-01-02T10:00:00Z'))
    expect(['learning', 'mastered']).toContain(status)
  })

  it('overdue card becomes unfamiliar with overdue reason', () => {
    const overdue = buildFsrsFieldsFromStat({
      practiceCount: 5,
      correctCount: 4,
      reps: 3,
      lapses: 1,
      fsrsState: 'Review',
      due: new Date('2020-01-01'),
      retrievability: 0.5,
      lastPractice: new Date('2020-01-01')
    }, new Date('2026-01-01'))

    expect(getMasteryStatus(overdue, new Date('2026-01-01'))).toBe('unfamiliar')
    expect(getWeakReason(overdue, new Date('2026-01-01'))).toBe('overdue')
  })

  it('replay history produces stable fields', () => {
    const fields = replayPracticeHistory([
      { isCorrect: true, createdAt: new Date('2026-01-01') },
      { isCorrect: false, createdAt: new Date('2026-01-02') },
      { isCorrect: true, createdAt: new Date('2026-01-03') }
    ])

    expect(fields.practiceCount).toBe(3)
    expect(fields.correctCount).toBe(2)
    expect(fields.due).toBeTruthy()
  })
})
