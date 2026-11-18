import { describe, expect, it } from 'vitest'
import { asFlatSense, normalizeSenseEntry, senseWithExamples } from './senses'

describe('senseWithExamples / nested senses', () => {
  it('stores one example as basic sentence under meanings[0]', () => {
    const sense = senseWithExamples({
      meaning: '飞',
      englishMeaning: 'to move through the air',
      phonetic: '/flaɪ/',
      examples: ['Birds fly over the school.']
    })
    expect(sense.meanings[0].meaning).toEqual({ zh: '飞', en: 'to move through the air' })
    expect(sense.meanings[0].sentences).toEqual([
      { en: 'Birds fly over the school.', role: 'basic' }
    ])
    expect(asFlatSense(sense).exampleSentence).toBe('Birds fly over the school.')
  })

  it('stores extra example as ext when examples has a second sentence', () => {
    const sense = senseWithExamples({
      meaning: '飞；苍蝇',
      englishMeaning: 'to move through the air; a small insect',
      phonetic: '/flaɪ/',
      exampleSentence: 'Birds fly over the school.',
      examples: ['A fly sits on the window.']
    })
    const flat = asFlatSense(sense)
    expect(flat.exampleSentence).toBe('Birds fly over the school.')
    expect(flat.examExample).toBe('A fly sits on the window.')
    expect(sense.meanings[0].sentences.map(s => s.role)).toEqual(['basic', 'ext'])
  })

  it('normalizes old flat entries into nested shape', () => {
    const sense = normalizeSenseEntry({
      meaning: '放弃',
      englishMeaning: 'to leave behind',
      phonetic: '/əˈbændən/',
      exampleSentence: 'Do not abandon hope.',
      exampleSentenceZh: '不要放弃希望。',
      examExample: 'They abandoned the plan.',
      cefr: 'B2',
      status: 'verified',
      origin: 'word-atlas'
    })
    expect(sense.level).toBe('B2')
    expect(sense.phonetic).toEqual({ g: '/əˈbændən/' })
    expect(sense.meanings[0].meaning.zh).toBe('放弃')
    expect(sense.status).toBe('verified')
  })
})
