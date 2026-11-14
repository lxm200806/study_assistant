import { describe, expect, it } from 'vitest'
import {
  answersMatch,
  liveMarks,
  parseWordTokens,
  pickQueueIds,
  splitPieces,
  splitSentences,
  type QueueCandidate
} from './typing-logic'

function row(partial: Partial<QueueCandidate> & Pick<QueueCandidate, 'id'>): QueueCandidate {
  return {
    sortOrder: 0,
    practiced: false,
    dueMs: null,
    recentLapse: false,
    inWrongBook: false,
    favorite: false,
    skipMastered: false,
    ...partial
  }
}

describe('typing queue', () => {
  const candidates = [
    row({ id: 'new', sortOrder: 1 }),
    row({ id: 'due', sortOrder: 2, practiced: true, dueMs: 50 }),
    row({ id: 'lapse', sortOrder: 3, practiced: true, dueMs: 10, recentLapse: true }),
    row({ id: 'later', sortOrder: 0, practiced: true }),
    row({ id: 'skip', sortOrder: 4, practiced: true, dueMs: 1, skipMastered: true, inWrongBook: true, favorite: true }),
    row({ id: 'wrong', sortOrder: 5, inWrongBook: true, practiced: true }),
    row({ id: 'star', sortOrder: 6, favorite: true })
  ]

  it('orders smart practice as lapse, due, unseen, then the rest, and skips mastered', () => {
    expect(pickQueueIds(candidates, 'smart', 10)).toEqual(['lapse', 'due', 'new', 'star', 'later', 'wrong'])
  })

  it('keeps mastered words available in the wrong-word and favorite sources', () => {
    expect(pickQueueIds(candidates, 'wrong', 10)).toEqual(['skip', 'wrong'])
    expect(pickQueueIds(candidates, 'favorite', 10)).toEqual(['skip', 'star'])
  })

  it('follows imported list order and drops mastered spellings', () => {
    expect(pickQueueIds(candidates, 'list', 10, { listIds: ['star', 'missing', 'skip', 'new'] })).toEqual(['star', 'new'])
  })

  it('shuffles random practice with the injected random source', () => {
    const values = [0.9, 0, 0]
    expect(pickQueueIds(candidates.filter(item => !item.skipMastered), 'random', 2, {
      random: () => values.shift() ?? 0
    })).toEqual(['due', 'lapse'])
  })
})

describe('typing text', () => {
  it('parses a pasted word list once per spelling', () => {
    expect(parseWordTokens('Apple, apple; mother-in-law\ndon’t 123')).toEqual([
      'apple',
      'mother-in-law',
      "don't"
    ])
  })

  it('splits articles into sentences', () => {
    expect(splitSentences('Cats sleep. Dogs run!\nBirds fly')).toEqual([
      'Cats sleep.',
      'Dogs run!',
      'Birds fly'
    ])
  })

  it('keeps a Chinese translation line for sentence pairing', () => {
    expect(splitPieces('猫在睡觉。\n狗在跑！')).toEqual(['猫在睡觉。', '狗在跑！'])
  })

  it('compares answers without case or extra spaces', () => {
    expect(answersMatch('Apple', ' apple, ', 'word')).toBe(true)
    expect(answersMatch('Apple', 'apply', 'word')).toBe(false)
    expect(answersMatch('Cats  sleep.', 'cats sleep.', 'sentence')).toBe(true)
  })

  it('marks the typed prefix against the shown word', () => {
    expect(liveMarks('Cat', 'cx')).toEqual([
      { ch: 'C', kind: 'ok' },
      { ch: 'a', kind: 'bad' },
      { ch: 't', kind: 'pending' }
    ])
  })
})
