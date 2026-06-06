import { describe, expect, it } from 'vitest'
import { sanitizeFreeChatReply } from './chat-reply-sanitize.service'

const drillReply = `Hello again! 😄
You're doing great.
Let's try one more friendly word from your list: bicycle.
Can you make a short sentence with bicycle?`

describe('sanitizeFreeChatReply', () => {
  it('detects and trims drill segment from a reply', () => {
    const result = sanitizeFreeChatReply(drillReply, 'hello again')
    // The drill sentences should be gone
    expect(result).not.toMatch(/make a short sentence with/i)
  })

  it('keeps natural friend-like replies untouched', () => {
    const natural = 'Hello! How are you doing today?'
    expect(sanitizeFreeChatReply(natural, 'hello')).toBe(natural)
  })

  it('keeps non-drill multi-sentence replies', () => {
    const reply = 'Nice! Apples are great. Do you prefer red ones or green ones?'
    expect(sanitizeFreeChatReply(reply, 'I like eat apple')).toBe(reply)
  })

  it('returns fallback when entire reply is a drill', () => {
    const allDrill = "Can you make a sentence with 'permit'? Let's practice this word!"
    const result = sanitizeFreeChatReply(allDrill, 'hi')
    expect(result).toBeTruthy()
    expect(result).not.toMatch(/make a sentence/i)
  })
})
