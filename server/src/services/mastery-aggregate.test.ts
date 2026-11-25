import { describe, expect, it } from 'vitest'
import {
  aggregateBookWordStats,
  aggregateWordMastery,
  buildTypeStatsFromEntry,
  practicedForType,
  skillSnapshot,
  type WordStatEntry
} from './mastery-aggregate.service'

function stat(
  overrides: Partial<WordStatEntry> & Pick<WordStatEntry, 'type'>
): WordStatEntry {
  return {
    wordId: 'w1',
    practiceCount: 3,
    correctCount: 3,
    mastery: 5,
    lastPractice: new Date('2026-11-01T00:00:00Z'),
    ...overrides
  }
}

describe('practicedForType', () => {
  it('only counts the requested skill', () => {
    const stats = [stat({ type: 'reading' })]

    expect(practicedForType(stats, 'reading')).toBe(true)
    expect(practicedForType(stats, 'writing')).toBe(false)
  })

  it('treats any practiced skill as covered when no type is given', () => {
    expect(practicedForType([stat({ type: 'listening' })])).toBe(true)
  })

  it('ignores stats that were never practiced', () => {
    const unpracticed = stat({ type: 'reading', practiceCount: 0 })

    expect(practicedForType([unpracticed], 'reading')).toBe(false)
    expect(practicedForType([unpracticed])).toBe(false)
  })
})

describe('needsReconfirm handling', () => {
  it('zeroes mastery and labels the skill as pending confirmation', () => {
    const snapshot = skillSnapshot([
      stat({ type: 'reading', mastery: 5, needsReconfirm: true })
    ])

    expect(snapshot.needsReconfirm).toBe(true)
    expect(snapshot.practiced).toBe(true)
    expect(snapshot.mastery).toBe(0)
    expect(snapshot.recognize).toBe(0)
    expect(snapshot.skillLabel).toContain('待核对')
  })

  it('downgrades an otherwise mastered word to partial', () => {
    const snapshot = skillSnapshot([
      stat({ type: 'reading', mastery: 5 }),
      stat({ type: 'writing', mastery: 5 }),
      stat({ type: 'listening', mastery: 4, needsReconfirm: true })
    ])

    expect(snapshot.needsReconfirm).toBe(true)
    expect(snapshot.skill).toBe('partial')
    expect(snapshot.mastery).toBe(0)
  })

  it('keeps byType in sync and exposes the flag through aggregateWordMastery', () => {
    const aggregated = aggregateWordMastery([
      stat({ type: 'reading', mastery: 5 }),
      stat({ type: 'writing', mastery: 5, needsReconfirm: true })
    ])

    expect(aggregated?.needsReconfirm).toBe(true)
    expect(aggregated?.mastery).toBe(0)
    expect(aggregated?.byType.reading).toBe(5)
    expect(aggregated?.byType.writing).toBe(0)
  })

  it('returns mastery 0 for a reconfirmation-pending type breakdown', () => {
    const breakdown = buildTypeStatsFromEntry(
      stat({ type: 'writing', mastery: 5, needsReconfirm: true })
    )

    expect(breakdown.mastery).toBe(0)
  })

  it('defaults the flag to false for unpracticed words', () => {
    const aggregated = aggregateBookWordStats(['missing'], new Map())

    expect(aggregated.get('missing')?.needsReconfirm).toBe(false)
  })
})
