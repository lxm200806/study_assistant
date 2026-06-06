import { describe, expect, it } from 'vitest'
import { mergeXfyunSegment } from './asr-xfyun.service'

describe('mergeXfyunSegment', () => {
  it('keeps sentence when final frame is punctuation only', () => {
    expect(mergeXfyunSegment('how are you', '?', true)).toBe('how are you?')
    expect(mergeXfyunSegment('how are you', '.', true)).toBe('how are you.')
  })

  it('prefers longer cumulative streaming text', () => {
    expect(mergeXfyunSegment('how', 'how are you', false)).toBe('how are you')
  })

  it('uses incoming text when current is empty', () => {
    expect(mergeXfyunSegment('', 'hello', false)).toBe('hello')
  })
})
