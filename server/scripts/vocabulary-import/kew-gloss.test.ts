import { describe, expect, it } from 'vitest'
import { glossKey, glossWord, mergeGloss, normalizeGlossMap } from './kew-gloss'

describe('gloss keys', () => {
  it('uses the word itself, and still reads old word::sense keys', () => {
    expect(glossKey('Fly', 'v')).toBe('fly')
    expect(glossWord('fly::insect')).toBe('fly')
    expect(glossWord('abandon::')).toBe('abandon')
  })

  it('merges same-word senses into one gloss with both examples', () => {
    const merged = normalizeGlossMap({
      'fly::v': {
        meaning: '飞',
        englishMeaning: 'to move through the air like a bird',
        phonetic: '/flaɪ/',
        exampleSentence: 'Birds fly over the school.'
      },
      'fly::insect': {
        meaning: '苍蝇',
        englishMeaning: 'a small insect with two wings',
        phonetic: '/flaɪ/',
        exampleSentence: 'A fly sits on the window.'
      }
    })

    expect(Object.keys(merged)).toEqual(['fly'])
    expect(merged.fly.meaning).toBe('飞；苍蝇')
    expect(merged.fly.englishMeaning).toBe('to move through the air like a bird; a small insect with two wings')
    expect(merged.fly.exampleSentence).toBe('Birds fly over the school.')
    expect(merged.fly.exampleSentences).toEqual([
      'Birds fly over the school.',
      'A fly sits on the window.'
    ])
  })

  it('keeps a second meaning when joining glosses', () => {
    const merged = mergeGloss(
      {
        meaning: '眼泪',
        englishMeaning: 'a drop of liquid from the eye',
        phonetic: '/tɪə/',
        exampleSentence: 'A tear ran down her face.'
      },
      {
        meaning: '撕开',
        englishMeaning: 'to pull something apart',
        phonetic: '/teə/',
        exampleSentence: 'Do not tear the paper.'
      }
    )
    expect(merged.meaning).toBe('眼泪；撕开')
  })
})
