import { beforeEach, describe, expect, it, vi } from 'vitest'

const typingMock = vi.hoisted(() => ({
  loadEnabledWordModes: vi.fn()
}))

vi.mock('@/utils/typing', () => typingMock)

import {
  EXAM_MODE_ORDER,
  LEARN_MODE_ORDER,
  buildExamQueue,
  loadExamModes,
  shuffleInPlace
} from './exam-builder'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('typing exam builder', () => {
  it('keeps learn modes before exam modes', () => {
    expect(LEARN_MODE_ORDER).toEqual(['follow', 'self'])
    expect(EXAM_MODE_ORDER).toEqual(['recall', 'dictation'])
  })

  it('defaults to both exam modes when nothing is saved', () => {
    typingMock.loadEnabledWordModes.mockReturnValue([])

    expect(loadExamModes()).toEqual(['recall', 'dictation'])
  })

  it('filters saved modes to recall/dictation', () => {
    typingMock.loadEnabledWordModes.mockReturnValue(['dictation', 'follow', 'recall'])

    expect(loadExamModes()).toEqual(['recall', 'dictation'])
  })

  it('builds one shuffled block per selected exam mode', () => {
    const cards = buildExamQueue(3, ['recall', 'dictation'])

    expect(cards).toHaveLength(6)
    expect(cards.slice(0, 3).every(card => card.mode === 'recall')).toBe(true)
    expect(cards.slice(3).every(card => card.mode === 'dictation')).toBe(true)
    expect(cards.slice(0, 3).map(card => card.wordIndex).sort()).toEqual([0, 1, 2])
    expect(cards.slice(3).map(card => card.wordIndex).sort()).toEqual([0, 1, 2])
  })

  it('builds only the enabled mode block', () => {
    const cards = buildExamQueue(2, ['dictation'])

    expect(cards).toHaveLength(2)
    expect(cards.every(card => card.mode === 'dictation')).toBe(true)
  })

  it('returns no cards when no exam mode is enabled', () => {
    expect(buildExamQueue(5, [])).toEqual([])
  })

  it('shuffles in place without dropping elements', () => {
    const list = [1, 2, 3, 4]

    const shuffled = shuffleInPlace(list)

    expect(shuffled).toBe(list)
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4])
  })
})
