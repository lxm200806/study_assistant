import { describe, expect, it } from 'vitest'
import { builtinArticles } from '../data/practice-articles'
import {
  answersMatch,
  articleKeyFor,
  liveMarks,
  mergeLexical,
  parseListDocument,
  parseWordTokens,
  partitionKnownSpellings,
  pickDueSentences,
  pickQueueIds,
  presentListMeaning,
  sentenceIsDue,
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

  it('splits articles into sentences and keeps titles like Mr.', () => {
    expect(splitSentences('Cats sleep. Dogs run!\nBirds fly')).toEqual([
      'Cats sleep.',
      'Dogs run!',
      'Birds fly'
    ])
    expect(splitSentences('Mr. Bennet waited on Mr. Bingley. Then he went home.')).toEqual([
      'Mr. Bennet waited on Mr. Bingley.',
      'Then he went home.'
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

describe('custom word lists', () => {
  it('keeps unknown spellings and reports tokens that cannot be practiced', () => {
    const { entries, rejected } = parseListDocument('apple\nzyzzx | 自造词 | syn: luck | uk: zyz | us: ziz\n12345\n')
    expect(entries.map(entry => entry.spelling)).toEqual(['apple', 'zyzzx'])
    expect(entries[1].gloss).toBe('自造词')
    expect(entries[1].synonyms).toBe('luck')
    expect(entries[1].phoneticUk).toBe('zyz')
    expect(entries[1].phoneticUs).toBe('ziz')
    expect(rejected).toEqual([{ token: '12345', reason: 'not_english' }])
  })

  it('does not drop unknown spellings when the catalog is missing them', () => {
    const { linked, unknown } = partitionKnownSpellings(
      [{ spelling: 'apple' }, { spelling: 'zyzzx' }],
      new Map([['apple', 'id-apple']])
    )
    expect(linked).toEqual([{ spelling: 'apple', wordId: 'id-apple' }])
    expect(unknown.map(entry => entry.spelling)).toEqual(['zyzzx'])
  })

  it('shows a learner gloss on a custom entry and keeps an official meaning', () => {
    expect(presentListMeaning({ meaning: '', ownerLearnerId: 'learner-1' }, '自造词')).toEqual({
      meaning: '自造词',
      note: ''
    })
    expect(presentListMeaning({ meaning: '苹果', ownerLearnerId: null }, '我的注释')).toEqual({
      meaning: '苹果',
      note: '我的注释'
    })
    expect(mergeLexical(
      { phoneticUk: '', phoneticUs: 'old', synonyms: 'book-syn' },
      { phoneticUk: 'uk-only', synonyms: '' }
    )).toEqual({
      phoneticUk: 'uk-only',
      phoneticUs: 'old',
      synonyms: 'book-syn',
      roots: '',
      etymology: '',
      phrases: ''
    })
  })
})

describe('article sentence reviews', () => {
  const now = new Date('2026-05-01T00:00:00Z').getTime()

  it('queues only sentences that are already due', () => {
    const cards = [
      { articleKey: 'builtin:library-rain', sentenceIndex: 1, practiceCount: 0, due: new Date(now - 1000), recentLapse: false },
      { articleKey: 'builtin:library-rain', sentenceIndex: 0, practiceCount: 2, due: new Date(now - 5000), recentLapse: false },
      { articleKey: 'user:a', sentenceIndex: 0, practiceCount: 1, due: new Date(now + 60000), recentLapse: false },
      { articleKey: 'user:a', sentenceIndex: 1, practiceCount: 1, due: new Date(now + 60000), recentLapse: true }
    ]
    expect(sentenceIsDue(cards[0], now)).toBe(false)
    expect(pickDueSentences(cards, now, 10).map(card => `${card.articleKey}#${card.sentenceIndex}`)).toEqual([
      'builtin:library-rain#0',
      'user:a#1'
    ])
  })

  it('pairs every built-in sentence with one translation line', () => {
    expect(builtinArticles.length).toBeGreaterThan(0)
    for (const article of builtinArticles) {
      const sentences = splitSentences(article.body)
      const translated = splitPieces(article.translation)
      expect(sentences.length).toBeGreaterThan(1)
      expect(translated).toHaveLength(sentences.length)
    }
  })

  it('keeps built-in keys separate from a learner article id', () => {
    expect(articleKeyFor('builtin:alice-bank').key).toBe('builtin:alice-bank')
    expect(articleKeyFor('article-1')).toEqual({
      key: 'user:article-1',
      builtinKey: null,
      userId: 'article-1'
    })
  })
})
