import { describe, expect, it } from 'vitest'
import { normalizeWord } from './normalize-word'

describe('normalizeWord', () => {
  it('normalizes curly quotes and full-width punctuation', () => {
    expect(normalizeWord('don’t')).toBe("don't")
    expect(normalizeWord('“hello”，world。')).toBe('"hello",world.')
  })

  it('keeps ordinary ASCII unchanged', () => {
    expect(normalizeWord('apple pie')).toBe('apple pie')
  })
})
