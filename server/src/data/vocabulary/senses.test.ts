import { describe, expect, it } from 'vitest'
import { senseWithExamples } from './senses'

describe('senseWithExamples', () => {
  it('keeps one example on exampleSentence', () => {
    const sense = senseWithExamples({
      meaning: '飞',
      englishMeaning: 'to move through the air',
      phonetic: '/flaɪ/',
      examples: ['Birds fly over the school.']
    })
    expect(sense.exampleSentence).toBe('Birds fly over the school.')
    expect(sense.exampleSentences).toBeUndefined()
  })

  it('keeps extra examples on exampleSentences', () => {
    const sense = senseWithExamples({
      meaning: '飞；苍蝇',
      englishMeaning: 'to move through the air; a small insect',
      phonetic: '/flaɪ/',
      exampleSentence: 'Birds fly over the school.',
      examples: ['A fly sits on the window.']
    })
    expect(sense.exampleSentence).toBe('Birds fly over the school.')
    expect(sense.exampleSentences).toEqual([
      'Birds fly over the school.',
      'A fly sits on the window.'
    ])
  })
})
