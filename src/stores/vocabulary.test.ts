import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useVocabularyStore } from './vocabulary'
import { resetUniMock, uniStorage } from '@/test/uni-mock'

beforeEach(() => {
  resetUniMock()
  setActivePinia(createPinia())
})

describe('vocabulary store settings', () => {
  it('canonicalizes book aliases and persists settings', () => {
    const store = useVocabularyStore()
    store.setCurrentBook('kew1')
    store.setStudySettings({ wordsPerGroup: 30, sessionMode: 'weak' })

    expect(store.currentBookCode).toBe('kew1200')
    expect(uniStorage.get('currentBookCode')).toBe('kew1200')

    setActivePinia(createPinia())
    const fresh = useVocabularyStore()
    fresh.loadSettings()
    expect(fresh.currentBookCode).toBe('kew1200')
    expect(fresh.studySettings.wordsPerGroup).toBe(30)
    expect(fresh.studySettings.sessionMode).toBe('weak')
  })

  it('defaults to the default book when no setting exists', () => {
    const store = useVocabularyStore()
    store.loadSettings()
    expect(store.currentBookCode).toBeTruthy()
  })
})
