import { describe, expect, it } from 'vitest'
import {
  bookSessionQuerySchema,
  chineseReviewBodySchema,
  completeSessionBodySchema,
  credentialsBodySchema,
  practiceBodySchema,
  typingAnswerBodySchema,
  typingQueueQuerySchema
} from './schemas'

describe('validation schemas', () => {
  it('rejects missing credentials', () => {
    expect(credentialsBodySchema.safeParse({ username: 'a' }).success).toBe(false)
    expect(credentialsBodySchema.safeParse({ username: 'a', password: 'b' }).success).toBe(true)
  })

  it('applies book session defaults and rejects unknown modes', () => {
    const parsed = bookSessionQuerySchema.parse({})
    expect(parsed.count).toBe(10)
    expect(parsed.mode).toBe('coverage')
    expect(bookSessionQuerySchema.safeParse({ mode: 'nope' }).success).toBe(false)
  })

  it('applies typing queue defaults', () => {
    const parsed = typingQueueQuerySchema.parse({})
    expect(parsed.source).toBe('smart')
    expect(parsed.mode).toBe('follow')
    expect(parsed.count).toBe(20)
  })

  it('requires a session token when completing a session', () => {
    const body = { bookCode: 'pep-g3a-2024', wordIds: ['w1'] }
    expect(completeSessionBodySchema.safeParse(body).success).toBe(false)
    expect(
      completeSessionBodySchema.safeParse({ ...body, sessionToken: 'token' }).success
    ).toBe(true)
  })

  it('validates practice and typing answers', () => {
    expect(practiceBodySchema.safeParse({ wordId: 'w1', type: 'reading', isCorrect: true }).success).toBe(true)
    expect(practiceBodySchema.safeParse({ wordId: 'w1', type: 'all', isCorrect: true }).success).toBe(false)
    expect(typingAnswerBodySchema.safeParse({ wordId: 'w1', isCorrect: true }).success).toBe(true)
    expect(typingAnswerBodySchema.safeParse({ wordId: 'w1', isCorrect: true, mode: 'x' }).success).toBe(false)
  })

  it('validates Chinese review self rating', () => {
    expect(chineseReviewBodySchema.safeParse({ pointId: 'p1', selfRating: 'known' }).success).toBe(true)
    expect(chineseReviewBodySchema.safeParse({ pointId: 'p1', selfRating: '' }).success).toBe(true)
    expect(chineseReviewBodySchema.safeParse({ pointId: 'p1', selfRating: 'maybe' }).success).toBe(false)
  })
})
