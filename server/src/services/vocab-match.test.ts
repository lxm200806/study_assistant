import { describe, it, expect } from 'vitest'
import { matchBookWords } from './vocab-match.service'

describe('matchBookWords', () => {
  const wordMap = new Map([
    ['hello', { wordId: '1', word: 'hello' }],
    ['world', { wordId: '2', word: 'world' }],
    ['traffic', { wordId: '3', word: 'traffic' }]
  ])

  it('matches whole words case-insensitively', () => {
    const result = matchBookWords('Hello world!', wordMap)
    expect(result.map(r => r.word).sort()).toEqual(['hello', 'world'])
  })

  it('does not match substrings', () => {
    const result = matchBookWords('helloworld', wordMap)
    expect(result).toHaveLength(0)
  })

  it('dedupes repeated words', () => {
    const result = matchBookWords('traffic and Traffic', wordMap)
    expect(result).toHaveLength(1)
    expect(result[0].word).toBe('traffic')
  })

  it('returns empty for blank text', () => {
    expect(matchBookWords('   ', wordMap)).toEqual([])
  })
})
