import { describe, expect, it } from 'vitest'
import { buildUniqueOptions } from './quiz-options'

describe('buildUniqueOptions', () => {
  it('returns the correct answer plus unique distractors', () => {
    const options = buildUniqueOptions('apple', ['苹果', '香蕉', '苹果', 'APPLE', '橘子'], 4)
    expect(options).toHaveLength(4)
    expect(options[0] === 'apple' || options.includes('apple')).toBe(true)
    expect(new Set(options.map(option => option.trim().toLowerCase())).size).toBe(4)
  })

  it('fills missing distractors', () => {
    const options = buildUniqueOptions('apple', [], 4)
    expect(options).toHaveLength(4)
    expect(options).toContain('apple')
  })
})
