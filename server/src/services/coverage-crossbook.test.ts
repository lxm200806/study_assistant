import { describe, expect, it } from 'vitest'
import type { AggregatedWordMastery } from './mastery-aggregate.service'

/** 纯函数抽测：全局已练应视为已覆盖 */
function buildCoveredSet(
  cycleIds: string[],
  aggregated: Map<string, Pick<AggregatedWordMastery, 'practiced'>>
): Set<string> {
  const covered = new Set(cycleIds)
  for (const [wordId, mastery] of aggregated) {
    if (mastery.practiced) covered.add(wordId)
  }
  return covered
}

describe('cross-book coverage', () => {
  it('treats globally practiced words as covered for a new book cycle', () => {
    const aggregated = new Map([
      ['ket-only', { practiced: true }],
      ['pet-new', { practiced: false }],
      ['shared', { practiced: true }]
    ])
    const covered = buildCoveredSet([], aggregated)
    expect(covered.has('ket-only')).toBe(true)
    expect(covered.has('shared')).toBe(true)
    expect(covered.has('pet-new')).toBe(false)
  })
})
