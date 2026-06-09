import { createContext, useContext, useCallback, useMemo, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import type { WordEntry } from '@/api/client'

const STORAGE_KEYS = {
  currentBook: 'study_assistant_current_book',
  meaningType: 'study_assistant_meaning_type',
  studySettings: 'study_assistant_study_settings',
  onboarded: 'study_assistant_onboarded',
  dailyGoal: 'study_assistant_daily_goal',
} as const

export type MeaningType = 'chinese' | 'english'

export interface StudySettings { wordsPerGroup: number; groupCount: number; sessionMode: 'coverage' | 'smart' }

const DEFAULT_BOOK_CODE = 'ket'
const DEFAULT_SETTINGS: StudySettings = { wordsPerGroup: 10, groupCount: 1, sessionMode: 'smart' }

let _currentBook: string = DEFAULT_BOOK_CODE
let _meaningType: MeaningType = 'chinese'
let _studySettings: StudySettings = { ...DEFAULT_SETTINGS }
let _onboarded: boolean = false
let _dailyGoal: number = 30
let _sessionTopic: string | undefined

export interface WordStats { word: string; mastery: number; count: number; correctCount: number; lastPractice?: number; type?: string; }

// Singleton class that manages state + persistence
export class VocabularyStoreSingleton {
  _statsMap = new Map<string, WordStats>()
  _words = new Set<string>()
  get statsMap() { return this._statsMap }
  get words() { return this._words }

  async loadSettings() {
    try {
      const b = await SecureStore.getItemAsync(STORAGE_KEYS.currentBook); if (b) _currentBook = b
      const m = await SecureStore.getItemAsync(STORAGE_KEYS.meaningType); if (m) _meaningType = m as MeaningType
      const s = await SecureStore.getItemAsync(STORAGE_KEYS.studySettings); if (s) { try { _studySettings = JSON.parse(s) } catch {} }
      const o = await SecureStore.getItemAsync(STORAGE_KEYS.onboarded); if (o) _onboarded = o === 'true'
      const d = await SecureStore.getItemAsync(STORAGE_KEYS.dailyGoal); if (d) _dailyGoal = Number(d)
    } catch {}
  }

  async loadState() {
    try {
      const raw = await SecureStore.getItemAsync('vocab_stats')
      if (raw) JSON.parse(raw).forEach(([w,s]) => this._statsMap.set(w, s))
    } catch {}
  }

  saveState() { try { SecureStore.setItemAsync('vocab_stats', JSON.stringify(Array.from(this._statsMap.entries()))).catch(() => {}) } catch {} }

  addWords(words: WordEntry[]) { words.forEach(w => { this._words.add(w.word); if (!this._statsMap.has(w.word)) this._statsMap.set(w.word, {word:w.word,mastery:0,count:0,correctCount:0,...w}) }) }

  updateWord(word: string, masteryDelta = 1, isCorrect = false) {
    const s = this._statsMap.get(word) || { word, mastery: 0, count: 0, correctCount: 0 }
    s.count++; if (isCorrect) s.correctCount++
    s.mastery = Math.min(5, (s.mastery ?? 0) + masteryDelta)
    s.lastPractice = Date.now()
    this._statsMap.set(word, s as WordStats)
  }

  getWordMastery(w: string) { return this._statsMap.get(w)?.mastery ?? 0 }
  getWordStats(w: string) { return this._statsMap.get(w) }
  getProgress(bc = _currentBook) { const s = Array.from(this._statsMap.values()); return { total:s.length, mastered:s.filter(w=>w.mastery>=4).length, learning:s.filter(w=>w.mastery>0&&w.mastery<4).length, notStarted:0 } }
  reset() { this._words.clear(); this._statsMap.clear() }
}

export const VOCAB_STORE = new VocabularyStoreSingleton()

// React Provider Component (makes singleton reactive)
const VocabularyStoreContext = createContext<any>(null)

export function VocabularyProvider({ children }: { children: React.ReactNode }) {
  const [currentBook, setCurrentBook] = useState(_currentBook)
  const [meaningType, setMeaningType] = useState(_meaningType)
  const [studySettings, setStudySettingsState] = useState(_studySettings)
  const [onboarded, setOnboarded] = useState(_onboarded)

  useEffect(() => { VOCAB_STORE.loadSettings().catch(() => {}) }, [])

  const setCurrentBookSync = useCallback((code: string) => { _currentBook=code; setCurrentBook(code); SecureStore.setItemAsync(STORAGE_KEYS.currentBook,code).catch(()=>{}) }, [])
  const setMeaningTypeSync = useCallback((t: MeaningType) => { _meaningType=t; setMeaningType(t); SecureStore.setItemAsync(STORAGE_KEYS.meaningType,t).catch(()=>{}) }, [])
  const setStudySettingsSync = useCallback((s: Partial<StudySettings>) => { _studySettings={..._studySettings,...s}; setStudySettingsState(_studySettings); SecureStore.setItemAsync(STORAGE_KEYS.studySettings,JSON.stringify(_studySettings)).catch(()=>{}) }, [])
  const setOnboardedSync = useCallback((v: boolean) => { _onboarded=v; setOnboarded(v); SecureStore.setItemAsync(STORAGE_KEYS.onboarded,String(v)).catch(()=>{}) }, [])

  const value = useMemo(() => ({
    currentBook, meaningType, studySettings, onboarded, statsMap: VOCAB_STORE.statsMap, words: VOCAB_STORE.words,
    setCurrentBook: setCurrentBookSync, setMeaningType: setMeaningTypeSync, setStudySettings: setStudySettingsSync, setOnboarded: setOnboardedSync,
    loadState: () => VOCAB_STORE.loadState(), saveState: () => VOCAB_STORE.saveState(),
    updateWord: (w,m,i) => VOCAB_STORE.updateWord(w,m,i), getWordMastery: VOCAB_STORE.getWordMastery.bind(VOCAB_STORE),
    getWordStats: VOCAB_STORE.getWordStats.bind(VOCAB_STORE), getProgress: VOCAB_STORE.getProgress.bind(VOCAB_STORE)
  }), [currentBook, meaningType, studySettings, onboarded, setCurrentBookSync, setMeaningTypeSync, setStudySettingsSync, setOnboardedSync])

  return <VocabularyStoreContext.Provider value={value}>{children}</VocabularyStoreContext.Provider>
}

export function useVocabulary() { const ctx = useContext(VocabularyStoreContext); if (!ctx) throw new Error('useVocabulary must be used inside VocabularyProvider'); return ctx }
Object.defineProperty(VOCAB_STORE,'currentBook',{get:()=>_currentBook})
Object.defineProperty(VOCAB_STORE,'meaningType',{get:()=>_meaningType})
Object.defineProperty(VOCAB_STORE,'studySettings',{get:()=>_studySettings})
Object.defineProperty(VOCAB_STORE,'onboarded',{get:()=>_onboarded})
VOCAB_STORE.setCurrentBook = (c:string)=>{_currentBook=c;setCurrentBook(c)}
VOCAB_STORE.setMeaningType = (t:MeaningType)=>{_meaningType=t;setMeaningType(t)}
VOCAB_STORE.setOnboarded = (v:boolean)=>{_onboarded=v;setOnboarded(v)}
VOCAB_STORE.setDailyGoal = (n:number)=>{_dailyGoal=n}
VOCAB_STORE.getDailyGoal = ()=>_dailyGoal
VOCAB_STORE.setStudySettings = (s:Partial<StudySettings>)=>{_studySettings={..._studySettings,...s};setStudySettingsState(_studySettings)}
VOCAB_STORE.setSessionTopic = (t:string)=>{_sessionTopic=t}
