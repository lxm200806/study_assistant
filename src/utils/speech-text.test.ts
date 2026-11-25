import { describe, expect, it } from 'vitest'
import { isMeaningfulSpeechText } from './speech-text'

describe('isMeaningfulSpeechText', () => {
  it('requires at least two letters or Chinese characters', () => {
    expect(isMeaningfulSpeechText('')).toBe(false)
    expect(isMeaningfulSpeechText('a')).toBe(false)
    expect(isMeaningfulSpeechText('ab')).toBe(true)
    expect(isMeaningfulSpeechText('你好')).toBe(true)
  })

  it('ignores punctuation-only transcripts', () => {
    expect(isMeaningfulSpeechText('...!!!')).toBe(false)
  })
})
