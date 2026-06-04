import { describe, it, expect } from 'vitest'
import { computeSpeechScore, normalizeSpeechText } from './speech.service'

describe('normalizeSpeechText', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeSpeechText('Hello, World!')).toBe('hello world')
  })
})

describe('computeSpeechScore', () => {
  it('scores exact match highly', () => {
    expect(computeSpeechScore('hello world', 'hello world')).toBeGreaterThanOrEqual(90)
  })

  it('scores partial overlap lower', () => {
    const score = computeSpeechScore('hello world', 'hello there')
    expect(score).toBeGreaterThan(30)
    expect(score).toBeLessThan(90)
  })

  it('returns zero for empty transcript', () => {
    expect(computeSpeechScore('hello', '')).toBe(0)
  })

  it('handles example sentences', () => {
    const ref = 'I am afraid of traffic'
    const trans = 'i am afraid of the traffic'
    expect(computeSpeechScore(ref, trans)).toBeGreaterThanOrEqual(85)
  })
})
