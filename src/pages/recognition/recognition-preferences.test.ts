import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({
  getStored: vi.fn(),
  setStored: vi.fn()
}))

vi.mock('@/platform/storage', () => storage)

import {
  loadAutoSkip,
  loadEnabledRecogModes,
  normalizeRecogModes,
  saveAutoSkip,
  saveEnabledRecogModes
} from './recognition-preferences'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recognition preferences', () => {
  it('falls back to all modes when nothing is stored', () => {
    storage.getStored.mockReturnValue(null)

    expect(loadEnabledRecogModes()).toEqual(['zh', 'en', 'listen'])
  })

  it('filters unknown modes and keeps canonical order', () => {
    storage.getStored.mockReturnValue(['listen', 'bogus', 'zh'])

    expect(loadEnabledRecogModes()).toEqual(['zh', 'listen'])
  })

  it('parses legacy JSON string values', () => {
    expect(normalizeRecogModes('["en","listen"]')).toEqual(['en', 'listen'])
    expect(normalizeRecogModes('not-json')).toEqual(['zh', 'en', 'listen'])
  })

  it('persists normalized modes', () => {
    saveEnabledRecogModes(['listen', 'zh'])

    expect(storage.setStored).toHaveBeenCalledWith('recog-enabled-modes', ['zh', 'listen'])
  })

  it('defaults auto-skip on and respects explicit off values', () => {
    storage.getStored.mockReturnValue(null)
    expect(loadAutoSkip()).toBe(true)

    storage.getStored.mockReturnValue('0')
    expect(loadAutoSkip()).toBe(false)

    storage.getStored.mockReturnValue(false)
    expect(loadAutoSkip()).toBe(false)

    storage.getStored.mockReturnValue(0)
    expect(loadAutoSkip()).toBe(false)
  })

  it('persists auto-skip as 1/0', () => {
    saveAutoSkip(true)
    saveAutoSkip(false)

    expect(storage.setStored).toHaveBeenNthCalledWith(1, 'recog-auto-skip', '1')
    expect(storage.setStored).toHaveBeenNthCalledWith(2, 'recog-auto-skip', '0')
  })
})
