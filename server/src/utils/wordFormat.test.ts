import { describe, expect, it } from 'vitest'
import { pickRotatedItem, formatBookWord } from '../utils/wordFormat'

describe('example rotation', () => {
  it('picks a stable example for the same seed', () => {
    const items = ['Birds fly over the school.', 'A fly sits on the window.']
    expect(pickRotatedItem(items, 'id:2026-09-14')).toBe(pickRotatedItem(items, 'id:2026-09-14'))
  })

  it('prefers the book meaning over the global word meaning', () => {
    const formatted = formatBookWord({
      meaning: '能够',
      englishMeaning: 'having the skill to do something',
      exampleSentences: ['She is able to ride a bike.'],
      word: {
        id: '1',
        word: 'able',
        meaning: '有能力的',
        phonetic: '/ˈeɪbl/',
        englishMeaning: 'a listed target word: able',
        exampleSentence: 'Students study the word able in this book.'
      }
    })
    expect(formatted.meaning).toBe('能够')
    expect(formatted.englishMeaning).toBe('having the skill to do something')
    expect(formatted.phonetic).toBe('/ˈeɪbl/')
    expect(formatted.example).toBe('She is able to ride a bike.')
  })

  it('uses the book example in catalog mode', () => {
    const formatted = formatBookWord({
      exampleSentences: ['Birds fly over the school.', 'A fly sits on the window.'],
      word: {
        id: '1',
        word: 'fly',
        meaning: '飞',
        phonetic: '/flaɪ/',
        englishMeaning: 'to move through the air',
        exampleSentence: 'We use the word fly in class.'
      }
    })
    expect(formatted.example).toBe('Birds fly over the school.')
    expect(formatted.examples).toHaveLength(2)
  })
})
