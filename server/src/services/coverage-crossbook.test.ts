import { describe, expect, it } from 'vitest'
import { practicedForType, type WordStatEntry } from './mastery-aggregate.service'

/** 纯函数抽测：全局已练（同一技能）应视为已覆盖 */
function buildCoveredSet(
  cycleIds: string[],
  statsByWordId: Map<string, WordStatEntry[]>,
  trainingType?: string
): Set<string> {
  const covered = new Set(cycleIds)
  for (const [wordId, stats] of statsByWordId) {
    if (practicedForType(stats, trainingType)) covered.add(wordId)
  }
  return covered
}

function stat(type: WordStatEntry['type'], mastery = 5): WordStatEntry {
  return {
    wordId: 'w',
    type,
    practiceCount: 3,
    correctCount: 3,
    mastery,
    lastPractice: new Date('2026-11-01T00:00:00Z')
  }
}

describe('cross-book coverage', () => {
  it('treats globally practiced words as covered for a new book cycle', () => {
    const stats = new Map([
      ['ket-only', [stat('reading')]],
      ['pet-new', []],
      ['shared', [stat('reading')]]
    ])
    const covered = buildCoveredSet([], stats, 'reading')
    expect(covered.has('ket-only')).toBe(true)
    expect(covered.has('shared')).toBe(true)
    expect(covered.has('pet-new')).toBe(false)
  })

  it('does not treat another skill as covered', () => {
    const stats = new Map([['reading-only', [stat('reading')]]])

    expect(buildCoveredSet([], stats, 'writing').has('reading-only')).toBe(false)
    expect(buildCoveredSet([], stats, 'reading').has('reading-only')).toBe(true)
  })
})
