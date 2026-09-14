import { describe, expect, it } from 'vitest'
import { collectBookWordEntries } from './book-entries'

describe('collectBookWordEntries', () => {
  it('merges the same spelling and keeps both examples', () => {
    const rows = collectBookWordEntries([
      {
        word: 'fly',
        meaning: '飞',
        phonetic: '/flaɪ/',
        englishMeaning: 'to move through the air',
        exampleSentence: 'Birds fly over the school.',
        senseKey: 'v'
      },
      {
        word: 'Fly',
        meaning: '苍蝇',
        phonetic: '/flaɪ/',
        englishMeaning: 'a small insect',
        exampleSentence: 'A fly sits on the window.',
        senseKey: 'insect'
      }
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0].word).toBe('fly')
    expect(rows[0].meaning).toBe('飞；苍蝇')
    expect(rows[0].englishMeaning).toBe('to move through the air; a small insect')
    expect(rows[0].examples).toEqual([
      'Birds fly over the school.',
      'A fly sits on the window.'
    ])
  })

  it('keeps different spellings apart', () => {
    const rows = collectBookWordEntries([
      { word: 'able', meaning: '能够', phonetic: '/ˈeɪbl/', englishMeaning: 'having skill', exampleSentence: 'She is able to ride.' },
      { word: 'about', meaning: '关于', phonetic: '/əˈbaʊt/', englishMeaning: 'on the subject of', exampleSentence: 'Talk about it.' }
    ])
    expect(rows.map(item => item.word)).toEqual(['able', 'about'])
  })
})
