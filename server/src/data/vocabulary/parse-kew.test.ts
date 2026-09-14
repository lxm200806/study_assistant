import { describe, it, expect } from 'vitest'
import { flattenKewBook, kewSenseLookupKey, KEW_SENSE_OVERRIDES } from '../../../scripts/vocabulary-import/parse-kew'
import type { KewBookSource } from '../../../scripts/vocabulary-import/parse-kew'

function book(code: string, units: KewBookSource['units']): KewBookSource {
  return {
    code,
    name: code,
    description: '',
    level: 'A1',
    targetWordCount: units.reduce((sum, unit) => sum + unit.words.length, 0),
    units
  }
}

describe('flattenKewBook', () => {
  it('keeps fly once when it appears again later', () => {
    const result = flattenKewBook(book('kew1200-1', [
      { id: 'u1', title: 'Unit 1', words: ['ball', 'fly'] },
      { id: 'b4', title: 'Bonus 4 Insects & Flowers', theme: 'Insects & Flowers', words: ['ant', 'fly'] }
    ]))

    const flies = result.words.filter(item => item.word === 'fly')
    expect(flies).toHaveLength(1)
    expect(result.words).toHaveLength(3)
    expect(result.duplicates).toHaveLength(1)
  })

  it('keeps tear once when noun and verb both appear', () => {
    const result = flattenKewBook(book('kew1200-2', [
      { id: 'u9', title: 'Unit 9', words: ['air', 'tear'] },
      { id: 'u16', title: 'Unit 16', words: ['appear', 'tear'] }
    ]))

    expect(result.words.filter(item => item.word === 'tear')).toHaveLength(1)
    expect(result.duplicates).toHaveLength(1)
  })

  it('splits watch across books by sense key', () => {
    expect(KEW_SENSE_OVERRIDES[kewSenseLookupKey('kew1200-1', 'u7', 'watch')].senseKey).toBe('v')
    expect(KEW_SENSE_OVERRIDES[kewSenseLookupKey('kew1200-3', 'b3', 'watch')].senseKey).toBe('n')
  })

  it('skips true same-sense duplicates', () => {
    const result = flattenKewBook(book('kew1200-1', [
      { id: 'u2', title: 'Unit 2', words: ['tree', 'tree'] }
    ]))
    expect(result.words.filter(item => item.word === 'tree')).toHaveLength(1)
    expect(result.duplicates).toHaveLength(1)
  })

  it('splits 4500 iron and major by curriculum sense', () => {
    expect(KEW_SENSE_OVERRIDES[kewSenseLookupKey('kew4500-1', 'u31', 'iron')].senseKey).toBe('metal')
    expect(KEW_SENSE_OVERRIDES[kewSenseLookupKey('kew4500-4', 'u18', 'iron')].senseKey).toBe('appliance')
    expect(KEW_SENSE_OVERRIDES[kewSenseLookupKey('kew4500-1', 'u14', 'major')].senseKey).toBe('n')
    expect(KEW_SENSE_OVERRIDES[kewSenseLookupKey('kew4500-4', 'u40', 'major')].senseKey).toBe('adj')

    const result = flattenKewBook(book('kew4500-1', [
      { id: 'u14', title: 'Unit 14', words: ['major'] },
      { id: 'u31', title: 'Unit 31', words: ['iron'] }
    ]))
    expect(result.words.map(item => item.word).sort()).toEqual(['iron', 'major'])
  })
})
