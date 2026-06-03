import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Vocabulary, VocabularyStats, TrainingRecord, MeaningType } from '@/types'
import { vocabularyAPI, trainingAPI, bookAPI, statsAPI } from '@/utils/api'
import { getBookList } from '@/data/vocabulary'
import type { SessionMode, BookProgress, VocabularyMapData, SessionResponse } from '@/types/map'

export interface Book {
  id: string
  code: string
  name: string
  description: string
  level: string
  wordCount: number
  targetWordCount?: number
}

export type { MeaningType }

export interface StudySettings {
  wordsPerGroup: number
  groupCount: number
  sessionMode: SessionMode
}

const DEFAULT_BOOK_CODE = 'ket'

export const useVocabularyStore = defineStore('vocabulary', () => {
  const vocabularyList = ref<Vocabulary[]>([])
  const stats = ref<VocabularyStats>({
    listening: {},
    speaking: {},
    reading: {},
    writing: {}
  })
  const trainingRecords = ref<TrainingRecord[]>([])
  const serverStats = ref({
    listening: { total: 0, mastered: 0 },
    speaking: { total: 0, mastered: 0 },
    reading: { total: 0, mastered: 0 },
    writing: { total: 0, mastered: 0 }
  })

  const books = ref<Book[]>(getBookList())
  const currentBookCode = ref<string>(DEFAULT_BOOK_CODE)
  const meaningType = ref<MeaningType>('chinese')
  
  const studySettings = ref<StudySettings>({
    wordsPerGroup: 10,
    groupCount: 3,
    sessionMode: 'coverage'
  })

  const bookProgress = ref<BookProgress | null>(null)
  const bookMapData = ref<VocabularyMapData | null>(null)
  const globalMapData = ref<VocabularyMapData | null>(null)

  const loadVocabulary = async () => {
    try {
      const result = await vocabularyAPI.list()
      vocabularyList.value = result.data || []
    } catch (error) {
      console.error('Failed to load vocabulary:', error)
    }
  }

  const loadRandomVocabulary = async (count: number = 10) => {
    await loadSessionVocabulary(count)
  }

  const loadSessionVocabulary = async (count: number = 10, trainingType?: string) => {
    try {
      if (currentBookCode.value) {
        const result = await bookAPI.session(
          currentBookCode.value,
          count,
          studySettings.value.sessionMode,
          trainingType
        )
        const data = result.data as SessionResponse | undefined
        vocabularyList.value = data?.words || []
        bookProgress.value = data?.progress || null
        return
      }

      const result = await vocabularyAPI.random(count)
      vocabularyList.value = (result.data as Vocabulary[]) || []
    } catch (error) {
      console.error('Failed to load session vocabulary:', error)
      vocabularyList.value = []
    }
  }

  const loadBookProgress = async (bookCode?: string) => {
    const code = bookCode || currentBookCode.value
    if (!code) return
    try {
      const result = await bookAPI.progress(code)
      bookProgress.value = (result.data as BookProgress) || null
    } catch (error) {
      console.error('Failed to load book progress:', error)
    }
  }

  const loadBookMap = async (bookCode?: string, trainingType?: string) => {
    const code = bookCode || currentBookCode.value
    if (!code) return
    try {
      const result = await statsAPI.bookMap(code, trainingType)
      bookMapData.value = (result.data as VocabularyMapData) || null
    } catch (error) {
      console.error('Failed to load book map:', error)
    }
  }

  const loadGlobalMap = async () => {
    try {
      const result = await statsAPI.globalMap()
      globalMapData.value = (result.data as VocabularyMapData) || null
    } catch (error) {
      console.error('Failed to load global map:', error)
    }
  }

  const completeSession = async (wordIds: string[]) => {
    if (!currentBookCode.value || wordIds.length === 0) return 0
    try {
      const result = await trainingAPI.completeSession(currentBookCode.value, wordIds)
      await loadBookProgress()
      return (result as { newlyCovered?: number }).newlyCovered || 0
    } catch (error) {
      console.error('Failed to complete session:', error)
      return 0
    }
  }

  const setFullBookRound = () => {
    const book = getCurrentBook.value
    if (!book) return
    setStudySettings({
      wordsPerGroup: book.wordCount,
      groupCount: 1
    })
  }

  const loadBooks = async () => {
    try {
      const result = await bookAPI.list()
      books.value = result.data || books.value
    } catch (error) {
      console.error('Failed to load books:', error)
    }
  }

  const setCurrentBook = (code: string) => {
    currentBookCode.value = code
    uni.setStorageSync('currentBookCode', code)
  }

  const setMeaningType = (type: MeaningType) => {
    meaningType.value = type
    uni.setStorageSync('meaningType', type)
  }

  const setStudySettings = (settings: Partial<StudySettings>) => {
    studySettings.value = { ...studySettings.value, ...settings }
    uni.setStorageSync('studySettings', studySettings.value)
  }

  const loadSettings = () => {
    const savedBook = uni.getStorageSync('currentBookCode')
    const savedMeaning = uni.getStorageSync('meaningType') as MeaningType
    const savedSettings = uni.getStorageSync('studySettings') as StudySettings

    currentBookCode.value = savedBook || DEFAULT_BOOK_CODE
    if (savedMeaning) {
      meaningType.value = savedMeaning
    }
    if (savedSettings) {
      studySettings.value = {
        ...studySettings.value,
        ...savedSettings,
        sessionMode: savedSettings.sessionMode || 'coverage'
      }
    }
  }

  const setSessionMode = (mode: SessionMode) => {
    setStudySettings({ sessionMode: mode })
  }

  const ensureBookSelected = (): boolean => {
    if (!currentBookCode.value) {
      uni.showToast({ title: '请先选择词汇书', icon: 'none' })
      return false
    }
    return true
  }

  const loadServerStats = async () => {
    try {
      const result = await vocabularyAPI.stats()
      serverStats.value = result.data || serverStats.value
    } catch (error) {
      console.error('Failed to load server stats:', error)
    }
  }

  const loadStats = () => {
    const saved = uni.getStorageSync('vocabularyStats')
    if (saved) {
      stats.value = saved
    }
  }

  const saveStats = () => {
    uni.setStorageSync('vocabularyStats', stats.value)
  }

  const updateWordStats = async (wordId: string, word: string, type: 'listening' | 'speaking' | 'reading' | 'writing', correct: boolean) => {
    try {
      await trainingAPI.practice(wordId, type, correct)
    } catch (error) {
      console.error('Failed to update server stats:', error)
    }
    
    if (!stats.value[type][word]) {
      stats.value[type][word] = {
        count: 0,
        correctCount: 0,
        lastPractice: Date.now(),
        mastery: 0
      }
    }

    stats.value[type][word].count++
    if (correct) {
      stats.value[type][word].correctCount++
    }
    stats.value[type][word].lastPractice = Date.now()
    
    const accuracy = stats.value[type][word].correctCount / stats.value[type][word].count
    stats.value[type][word].mastery = Math.round(accuracy * 5)

    saveStats()
  }

  const getWordMastery = (word: string, type: 'listening' | 'speaking' | 'reading' | 'writing') => {
    return stats.value[type][word]?.mastery || 0
  }

  const getWordStats = (word: string, type: 'listening' | 'speaking' | 'reading' | 'writing') => {
    return stats.value[type][word]
  }

  const getTypeStats = (type: 'listening' | 'speaking' | 'reading' | 'writing') => {
    const words = stats.value[type]
    const total = Object.keys(words).length
    const mastered = Object.values(words).filter(w => w.mastery >= 4).length
    const avgMastery = total > 0 
      ? Math.round(Object.values(words).reduce((sum, w) => sum + w.mastery, 0) / total) 
      : 0

    return { total, mastered, avgMastery }
  }

  const getWordsForReview = async (type: 'listening' | 'speaking' | 'reading' | 'writing', limit: number = 5) => {
    try {
      const result = await trainingAPI.review()
      const reviewWords = (result.data || []).filter((r: any) => r.type === type)
      return reviewWords.slice(0, limit).map((r: any) => r.word?.word || r.wordId)
    } catch (error) {
      console.error('Failed to get review words:', error)
      return []
    }
  }

  const addTrainingRecord = (type: 'listening' | 'speaking' | 'reading' | 'writing', word: string, correct: boolean) => {
    const record: TrainingRecord = {
      id: Date.now().toString(),
      type,
      word,
      correct,
      timestamp: Date.now()
    }
    trainingRecords.value.unshift(record)
    if (trainingRecords.value.length > 100) {
      trainingRecords.value.pop()
    }
    uni.setStorageSync('trainingRecords', trainingRecords.value)
  }

  const loadTrainingRecords = () => {
    const saved = uni.getStorageSync('trainingRecords')
    if (saved) {
      trainingRecords.value = saved
    }
  }

  const getTodayRecords = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.getTime()
    return trainingRecords.value.filter(r => r.timestamp >= todayStart)
  })

  const getTodayStats = computed(() => {
    const today = getTodayRecords.value
    const total = today.length
    const correct = today.filter(r => r.correct).length
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
    
    const byType: Record<string, { total: number; correct: number }> = {
      listening: { total: 0, correct: 0 },
      speaking: { total: 0, correct: 0 },
      reading: { total: 0, correct: 0 },
      writing: { total: 0, correct: 0 }
    }
    
    today.forEach(r => {
      byType[r.type].total++
      if (r.correct) byType[r.type].correct++
    })

    return { total, correct, accuracy, byType }
  })

  const getCurrentBook = computed(() => {
    return books.value.find(b => b.code === currentBookCode.value)
  })

  return {
    vocabularyList,
    stats,
    serverStats,
    trainingRecords,
    books,
    currentBookCode,
    meaningType,
    studySettings,
    bookProgress,
    bookMapData,
    globalMapData,
    loadVocabulary,
    loadRandomVocabulary,
    loadSessionVocabulary,
    loadBookProgress,
    loadBookMap,
    loadGlobalMap,
    completeSession,
    setFullBookRound,
    setSessionMode,
    loadServerStats,
    loadStats,
    saveStats,
    updateWordStats,
    getWordMastery,
    getWordStats,
    getTypeStats,
    getWordsForReview,
    addTrainingRecord,
    loadTrainingRecords,
    getTodayRecords,
    getTodayStats,
    loadBooks,
    setCurrentBook,
    setMeaningType,
    setStudySettings,
    loadSettings,
    ensureBookSelected,
    getCurrentBook
  }
})