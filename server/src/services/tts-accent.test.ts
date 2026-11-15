import { describe, expect, it } from 'vitest'
import {
  cacheSuffix,
  parseTtsAccent,
  parseTtsGender,
  voiceForAccent
} from './tts-accent'

describe('tts accent', () => {
  it('defaults unknown values to US and keeps the old cache name', () => {
    expect(parseTtsAccent(undefined)).toBe('us')
    expect(parseTtsAccent('uk')).toBe('uk')
    expect(cacheSuffix('us')).toBe('.mp3')
    expect(cacheSuffix('uk')).toBe('.uk.mp3')
    expect(cacheSuffix('us', 'male')).toBe('.male.mp3')
    expect(cacheSuffix('uk', 'male')).toBe('.uk.male.mp3')
  })

  it('uses distinct UK and US voices', () => {
    expect(voiceForAccent('us')).not.toBe(voiceForAccent('uk'))
    expect(voiceForAccent('uk')).toContain('en-GB')
    expect(voiceForAccent('us', 'male')).not.toBe(voiceForAccent('us', 'female'))
    expect(parseTtsGender('male')).toBe('male')
    expect(parseTtsGender(undefined)).toBe('female')
  })
})
