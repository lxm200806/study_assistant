import { describe, expect, it } from 'vitest'
import { pickRecheckCandidates } from './recheck-queue'

const words = [{ wordId: 'a' }, { wordId: 'b' }, { wordId: 'c' }]

describe('pickRecheckCandidates', () => {
  it('skips words already confirmed in this book', () => {
    const { selected, meta } = pickRecheckCandidates(
      words,
      [
        { wordId: 'a', passed: true, failStreak: 0 },
        { wordId: 'b', passed: false, failStreak: 0 }
      ],
      () => 0,
      10
    )

    expect(selected.map(word => word.wordId)).toEqual(['b', 'c'])
    expect(meta).toEqual({ total: 3, remaining: 2, passed: 1, failed: 0, complete: false })
  })

  it('puts recently failed words first', () => {
    const { selected } = pickRecheckCandidates(
      words,
      [{ wordId: 'c', passed: false, failStreak: 2 }],
      wordId => (wordId === 'a' ? 500 : 0),
      2
    )

    expect(selected.map(word => word.wordId)).toEqual(['c', 'a'])
  })

  it('counts failed words that were never passed', () => {
    const { meta } = pickRecheckCandidates(
      words,
      [
        { wordId: 'a', passed: false, failStreak: 1 },
        { wordId: 'b', passed: true, failStreak: 0 }
      ],
      () => 0,
      10
    )

    expect(meta.passed).toBe(1)
    expect(meta.failed).toBe(1)
  })

  it('reports completion when every practiced word passed', () => {
    const { selected, meta } = pickRecheckCandidates(
      words,
      words.map(word => ({ wordId: word.wordId, passed: true, failStreak: 0 })),
      () => 0,
      10
    )

    expect(selected).toEqual([])
    expect(meta.complete).toBe(true)
    expect(meta.remaining).toBe(0)
  })

  it('limits the batch size', () => {
    const { selected, meta } = pickRecheckCandidates(words, [], () => 0, 1)

    expect(selected).toHaveLength(1)
    expect(meta.remaining).toBe(3)
  })
})
