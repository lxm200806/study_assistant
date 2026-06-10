// Vocabulary store for Study Assistant Mobile (singleton pattern)
import * as SecureStore from 'expo-secure-store'
import type { Book, Vocabulary, WordStats } from '@/types'

const STORAGE_KEYS = {
  currentBook: 'study_assistant_current_book',
  meaningType: 'study_assistant_meaning_type',
  studySettings: 'study_assistant_study_settings',
  onboarded: 'study_assistant_onboarded',
} as const

export type MeaningType = 'chinese' | 'english'

export interface StudySettings {
  wordsPerGroup: number
  groupCount: number
}

const DEFAULT_BOOK_CODE = 'ket'
const DEFAULT_SETTINGS: StudySettings = { wordsPerGroup: 10, groupCount: 1 }

// Singleton state
let _currentBook: string = DEFAULT_BOOK_CODE
let _meaningType: MeaningType = 'chinese'
let _studySettings: StudySettings = { ...DEFAULT_SETTINGS }
let _onboarded: boolean = false

export class VocabularyStoreSingleton {
  _statsMap = new Map<string, WordStats>()
  
  async loadSettings() {
    try {
      const bookCode = await SecureStore.getItemAsync(STORAGE_KEYS.currentBook)
      if (bookCode) _currentBook = bookCode
      
      const meaningType = await SecureStore.getItemAsync(STORAGE_KEYS.meaningType)
      if (meaningType) _meaningType = meaningType as MeaningType
      
      const settings = await SecureStore.getItemAsync(STORAGE_KEYS.studySettings)
      if (settings) {
        try {
          _studySettings = JSON.parse(settings)
        } catch {}
      }
      
      const onboarded = await SecureStore.getItemAsync(STORAGE_KEYS.onboarded)
      if (onboarded) _onboarded = onboarded === 'true'
    } catch {}
  }

  async saveSettings() {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.currentBook, _currentBook)
      await SecureStore.setItemAsync(STORAGE_KEYS.meaningType, _meaningType)
      await SecureStore.setItemAsync(STORAGE_KEYS.studySettings, JSON.stringify(_studySettings))
      await SecureStore.setItemAsync(STORAGE_KEYS.onboarded, String(_onboarded))
    } catch {}
  }

  addWords(words: Vocabulary[]) {
    words.forEach(word => {
      if (!this._statsMap.has(word.word)) {
        this._statsMap.set(word.word, { word: word.word, mastery: 0, count: 0, correctCount: 0 })
      }
    })
  }

  updateWord(word: string, masteryDelta = 1, isCorrect = false) {
    const stat = this._statsMap.get(word) || { word, mastery: 0, count: 0, correctCount: 0 }
    stat.count++
    if (isCorrect) stat.correctCount++
    stat.mastery = Math.min(5, (stat.mastery ?? 0) + masteryDelta)
    stat.lastPractice = Date.now()
    this._statsMap.set(word, stat as WordStats)
  }

  getWordMastery(w: string): number {
    return this._statsMap.get(w)?.mastery ?? 0
  }

  getWordStats(w: string): WordStats | undefined {
    return this._statsMap.get(w)
  }

  reset() {
    this._statsMap.clear()
  }

  // Getters
  get currentBook(): string { return _currentBook }
  get meaningType(): MeaningType { return _meaningType }
  get studySettings(): StudySettings { return _studySettings }
  get onboarded(): boolean { return _onboarded }
  get statsMap(): Map<string, WordStats> { return this._statsMap }

  // Setters
  setCurrentBook(code: string) {
    _currentBook = code
  }
  
  setMeaningType(type: MeaningType) {
    _meaningType = type
  }
  
  setStudySettings(settings: Partial<StudySettings>) {
    _studySettings = { ..._studySettings, ...settings }
  }
  
  setOnboarded(value: boolean) {
    _onboarded = value
  }

  //Books (mock data - in production, fetch from API)
  getBooks(): Book[] {
    return [
      { id: '1', code: 'ket', name: 'KET Vocabulary', description: '½£ÇÅÍ¨ÓÃÓ¢Óï¿¼ÊÔ´Ê»ã', level: '³õ¼¶', wordCount: 1500 },
      { id: '2', code: 'pet', name: 'PET Vocabulary', description: '½£ÇÅÍ¨ÓÃÓ¢Óï¿¼ÊÔ´Ê»ã', level: 'ÖÐ¼¶', wordCount: 1800 },
      { id: '3', code: 'gaokao', name: '¸ß¿¼´Ê»ã', description: 'ÖÐ¹ú¸ß¿¼Ó¢Óï´Ê»ã', level: '¸ß¼¶', wordCount: 3500 },
    ]
  }

  getCurrentBook(): Book | undefined {
    return this.getBooks().find(b => b.code === _currentBook)
  }
}

// Export singleton
export const VOCAB_STORE = new VocabularyStoreSingleton()

// Helper functions for React components
export function getMeaningType(): MeaningType {
  return VOCAB_STORE.meaningType
}

export function setMeaningType(type: MeaningType) {
  VOCAB_STORE.setMeaningType(type)
}

