import { describe, expect, it } from 'vitest'
import type { WordData } from '../../src/data/vocabulary/types'
import { enrichWordFromAtlas, ensureBasicExample, syncLegacyExampleFields } from './enrich-from-atlas'

function baseWord(over: Partial<WordData> = {}): WordData {
  return {
    word: 'abandon',
    meaning: '放弃',
    phonetic: '/əˈbændən/',
    englishMeaning: 'to leave behind',
    exampleSentence: 'Do not abandon your old friends.',
    sources: {
      list: 'kew',
      meaning: 'kew',
      phonetic: 'kew',
      englishMeaning: 'kew',
      example: 'kew'
    },
    topic: 'abstract',
    ...over
  }
}

describe('enrich-from-atlas', () => {
  it('maps legacy exampleSentence to basic without changing text', () => {
    const word = baseWord()
    expect(ensureBasicExample(word)).toBe(true)
    expect(word.examples?.[0]).toMatchObject({
      role: 'basic',
      en: 'Do not abandon your old friends.',
      source: 'kew'
    })
    expect(ensureBasicExample(word)).toBe(false)
  })

  it('adds atlas exam/topic/cefr and keeps KEW basic', () => {
    const word = baseWord()
    const result = enrichWordFromAtlas(word, {
      w: 'abandon',
      topic: 'society',
      cefr: 'B2',
      ex: [
        { en: 'We had to abandon our car in the snow.', zh: '我们不得不将车弃在雪地里。' },
        {
          en: 'Cities should not abandon ambitious recycling programmes.',
          zh: '城市不应放弃回收计划。'
        }
      ]
    })
    expect(result.hit).toBe(true)
    expect(result.examAdded).toBe(true)
    expect(result.topicFilled).toBe(true)
    expect(result.cefrFilled).toBe(true)
    expect(word.examples?.find(e => e.role === 'basic')?.en).toBe('Do not abandon your old friends.')
    expect(word.examples?.find(e => e.role === 'exam')?.en).toContain('recycling')
    expect(word.topic).toBe('society')
    expect(word.cefr).toBe('B2')
    expect(word.exampleSentences?.[0]).toBe('Do not abandon your old friends.')
    expect(word.tags).toContain('src:lexicon=senses.json')
  })

  it('normalizes legacy abstract and syncs fields without atlas', () => {
    const word = baseWord({ topic: 'daily-life' })
    enrichWordFromAtlas(word, undefined)
    syncLegacyExampleFields(word)
    expect(word.topic).toBe('daily')
    expect(word.topics).toEqual(['daily'])
  })
})
