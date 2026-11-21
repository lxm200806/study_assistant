import { describe, expect, it, vi, afterEach } from 'vitest'
import { collectBookWordEntries, hydrateBookWord } from './book-entries'
import type { GlobalSense } from './senses'

const appleSense: GlobalSense = {
  meanings: [
    {
      pos: 'n.',
      meaning: { zh: '苹果', en: 'a fruit' },
      sentences: [{ en: 'I eat an apple.', zh: '我吃一个苹果。', role: 'basic' }]
    }
  ],
  phonetic: { g: '/ˈæpl/' },
  topic: 'daily',
  level: 'A1',
  status: 'llm',
  origin: 'test'
}

vi.mock('./senses', async importOriginal => {
  const actual = await importOriginal<typeof import('./senses')>()
  return {
    ...actual,
    lookupSense: (word: string) => (word.trim().toLowerCase() === 'apple' ? appleSense : undefined)
  }
})

describe('collectBookWordEntries', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('merges the same spelling and keeps both examples', () => {
    // 用总表里不存在的拼写，避免 hydrate 掺进真实 senses
    const rows = collectBookWordEntries([
      {
        word: 'zzflyx',
        meaning: '飞',
        phonetic: '/flaɪ/',
        englishMeaning: 'to move through the air',
        exampleSentence: 'Birds zzflyx over the school.',
        senseKey: 'v'
      },
      {
        word: 'Zzflyx',
        meaning: '苍蝇',
        phonetic: '/flaɪ/',
        englishMeaning: 'a small insect',
        exampleSentence: 'A zzflyx sits on the window.',
        senseKey: 'insect'
      }
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0].word).toBe('zzflyx')
    expect(rows[0].meaning).toBe('飞；苍蝇')
    expect(rows[0].englishMeaning).toBe('to move through the air; a small insect')
    expect(rows[0].examples).toEqual([
      'Birds zzflyx over the school.',
      'A zzflyx sits on the window.'
    ])
  })

  it('keeps different spellings apart', () => {
    const rows = collectBookWordEntries([
      {
        word: 'zzablex',
        meaning: '能够',
        phonetic: '/ˈeɪbl/',
        englishMeaning: 'having skill',
        exampleSentence: 'She is zzablex to ride.'
      },
      {
        word: 'zzaboutx',
        meaning: '关于',
        phonetic: '/əˈbaʊt/',
        englishMeaning: 'on the subject of',
        exampleSentence: 'Talk zzaboutx it.'
      }
    ])
    expect(rows.map(item => item.word)).toEqual(['zzablex', 'zzaboutx'])
  })

  it('hydrates slim book rows from global senses', () => {
    const hydrated = hydrateBookWord({
      word: 'apple',
      tags: ['kew-unit:u1'],
      senseKey: 'n'
    })
    expect(hydrated.meaning).toBe('苹果')
    expect(hydrated.englishMeaning).toBe('a fruit')
    expect(hydrated.phonetic).toBe('/ˈæpl/')
    expect(hydrated.exampleSentence).toBe('I eat an apple.')
    expect(hydrated.topic).toBe('daily')

    const rows = collectBookWordEntries([{ word: 'apple', tags: ['kew-unit:u1'] }])
    expect(rows[0].meaning).toBe('苹果')
    expect(rows[0].examples[0]).toBe('I eat an apple.')
  })
})
