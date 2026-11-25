import { describe, expect, it } from 'vitest'
import { isValidTtsText, sanitizeForTts, splitTextForTts } from './tts-text'

describe('tts text helpers', () => {
  it('strips markdown and emoji', () => {
    expect(sanitizeForTts('**Hello** 😀 world')).toBe('Hello world')
  })

  it('rejects text without enough letters', () => {
    expect(isValidTtsText('123 !')).toBe(false)
    expect(isValidTtsText('ok')).toBe(true)
  })

  it('splits long text into readable parts', () => {
    const parts = splitTextForTts('This is one sentence. This is another sentence.', 20)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every(part => isValidTtsText(part))).toBe(true)
  })
})
