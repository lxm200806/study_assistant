import { describe, expect, it } from 'vitest'
import { sentenceIsDue } from './typing-logic'
import { scheduleCard } from './typing-schedule'

describe('typing schedule cards', () => {
  const now = new Date('2026-04-01T00:00:00Z')

  it('schedules a sentence card without changing a separate writing stat', () => {
    const writing = {
      practiceCount: 4,
      correctCount: 4,
      reps: 4,
      fsrsState: 'Review',
      recentLapse: false
    }
    const sentence = scheduleCard({ practiceCount: 0, correctCount: 0 }, false, now)
    expect(writing).toEqual({
      practiceCount: 4,
      correctCount: 4,
      reps: 4,
      fsrsState: 'Review',
      recentLapse: false
    })
    expect(sentence.practiceCount).toBe(1)
    expect(sentence.recentLapse).toBe(true)
    expect(sentence.due).toBeInstanceOf(Date)
    expect(sentenceIsDue(sentence, now.getTime() + 7 * 24 * 60 * 60 * 1000)).toBe(true)
    expect(sentenceIsDue({ practiceCount: 0, due: null, recentLapse: false }, now.getTime())).toBe(false)
  })

  it('keeps follow and dictation ratings as separate results', () => {
    const follow = scheduleCard({ practiceCount: 0, correctCount: 0 }, true, now)
    const dictation = scheduleCard({ practiceCount: 0, correctCount: 0 }, false, now)
    expect(follow.recentLapse).toBe(false)
    expect(follow.correctCount).toBe(1)
    expect(dictation.recentLapse).toBe(true)
    expect(dictation.correctCount).toBe(0)
  })
})
