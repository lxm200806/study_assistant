import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Vocabulary, VocabularyStats, TrainingRecord, MeaningType } from '@/types'
import { vocabularyAPI, trainingAPI, bookAPI, statsAPI } from '@/utils/api'
import { getBookList } from '@/data/vocabulary'
import type {
  SessionMode,
  BookProgress,
  VocabularyMapData,
  SessionResponse,
  SessionRecheckMeta
} from '@/types/map'
import { unwrapStorage } from '@/utils/storage'

export interface Book {
  id: string
  code: string
  name: string
  description: string
  level: string
  wordCount: number
  isFree?: boolean
}

export type { MeaningType }

export interface StudySettings {
  wordsPerGroup: number
  groupCount: number
  sessionMode: SessionMode
}

const DEFAULT_BOOK_CODE = 'mse-ket'

function currentLearnerScope(): string {
  const raw = uni.getStorageSync('user')
  const user = unwrapStorage<{ id?: string; activeLearnerId?: string | null }>(raw)
    ?? (raw as { id?: string; activeLearnerId?: string | null } | undefined)
  const account = user?.id || 'anon'
  return user?.activeLearnerId ? `${account}:${user.activeLearnerId}` : account
}

function scopedKey(key: string): string {
  return `${key}:${currentLearnerScope()}`
}

function emptyStats(): VocabularyStats {
  return { listening: {}, speaking: {}, reading: {}, writing: {} }
}

export const useVocabularyStore = defineStore('vocabulary', () => {
  const vocabularyList = ref<Vocabulary[]>([])
  const stats = ref<VocabularyStats>(emptyStats())
  const trainingRecords = ref<TrainingRecord[]>([])
  const serverStats = ref({
    listening: { total: 0, mastered: 0, avgMastery: 0 },
    speaking: { total: 0, mastered: 0, avgMastery: 0 },
    reading: { total: 0, mastered: 0, avgMastery: 0 },
    writing: { total: 0, mastered: 0, avgMastery: 0 }
  })
  const serverStatsLoaded = ref(false)
  const dailyStats = ref({ date: '', wordCount: 0, goal: 30, streak: 0, progress: 0 })
  const sessionTopic = ref<string | undefined>(undefined)
  const sessionUnitId = ref<string | undefined>(undefined)
  /** 文章单元练习临时用的书，不写入 currentBookCode / 本地存储 */
  const sessionBookCode = ref<string | undefined>(undefined)
  const lastSessionUnit = ref<import('@/types/map').SessionUnitMeta | null>(null)
  const lastRecheckMeta = ref<SessionRecheckMeta | null>(null)
  /** 当前练习会话的词表凭证，完成会话时回传服务端校验。 */
  const sessionTokens = ref<string[]>([])

  const books = ref<Book[]>(getBookList())
  const currentBookCode = ref<string>(DEFAULT_BOOK_CODE)
  const meaningType = ref<MeaningType>('chinese')
  
  const   studySettings = ref<StudySettings>({
    wordsPerGroup: 10,
    groupCount: 1,
    sessionMode: 'smart'
  })

  const bookProgress = ref<BookProgress | null>(null)
  const dueCount = ref({ dueCount: 0, overdueCount: 0 })
  const bookMapData = ref<VocabularyMapData | null>(null)
  const globalMapData = ref<VocabularyMapData | null>(null)

  const loadVocabulary = async () => {
    try {
      const result = await vocabularyAPI.list()
      vocabularyList.value = (result.data as Vocabulary[] | undefined) || []
    } catch (error) {
      console.error('Failed to load vocabulary:', error)
    }
  }

  const loadRandomVocabulary = async (count: number = 10) => {
    await loadSessionVocabulary(count)
  }

  const resolveBookCode = () => sessionBookCode.value || currentBookCode.value

  const loadSessionVocabulary = async (
    count: number = 10,
    trainingType?: string,
    topic?: string,
    opts?: { mode?: SessionMode; unit?: string; excludeIds?: string[] }
  ): Promise<Vocabulary[]> => {
    try {
      const bookCode = resolveBookCode()
      if (bookCode) {
        const mode = opts?.mode || studySettings.value.sessionMode
        // 单元顺序学才带 unit；记忆曲线认读/拼读绝不混入单元参数
        const unit =
          mode === 'unit' ? opts?.unit || sessionUnitId.value || undefined : undefined
        const result = await bookAPI.session(
          bookCode,
          count,
          mode,
          trainingType,
          topic || sessionTopic.value,
          {
            unit,
            excludeIds: mode === 'unit' ? opts?.excludeIds : undefined
          }
        )
        const data = result.data as SessionResponse | undefined
        vocabularyList.value = data?.words || []
        bookProgress.value = data?.progress || null
        lastSessionUnit.value = data?.unit || null
        lastRecheckMeta.value = data?.recheck || null
        if (data?.sessionToken) addSessionToken(data.sessionToken)
        return vocabularyList.value
      }

      lastRecheckMeta.value = null
      const result = await vocabularyAPI.random(count)
      vocabularyList.value = (result.data as Vocabulary[]) || []
      return vocabularyList.value
    } catch (error) {
      console.error('Failed to load session vocabulary:', error)
      vocabularyList.value = []
      lastRecheckMeta.value = null
      const message = (error as Error).message || '加载词汇失败'
      if (message.includes('会员') || message.includes('BOOK_LOCKED') || message.includes('403')) {
        throw new Error('BOOK_LOCKED')
      }
      throw error
    }
  }

  const loadBookProgress = async (bookCode?: string) => {
    const code = bookCode || resolveBookCode()
    if (!code) return
    try {
      const result = await bookAPI.progress(code)
      bookProgress.value = (result.data as BookProgress) || null
    } catch (error) {
      console.error('Failed to load book progress:', error)
    }
  }

  const loadDueCount = async (bookCode?: string, trainingType?: string) => {
    const code = bookCode || currentBookCode.value
    if (!code) return
    try {
      const result = await bookAPI.dueCount(code, trainingType)
      dueCount.value = (result.data as { dueCount: number; overdueCount: number }) || { dueCount: 0, overdueCount: 0 }
    } catch (error) {
      console.error('Failed to load due count:', error)
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
      bookMapData.value = null
      throw error
    }
  }

  const loadGlobalMap = async () => {
    try {
      const result = await statsAPI.globalMap()
      globalMapData.value = (result.data as VocabularyMapData) || null
    } catch (error) {
      console.error('Failed to load global map:', error)
      globalMapData.value = null
      throw error
    }
  }

  const addSessionToken = (token: string) => {
    if (!token || sessionTokens.value.includes(token)) return
    sessionTokens.value = [...sessionTokens.value, token].slice(-50)
  }

  const resetSessionTokens = () => {
    sessionTokens.value = []
  }

  const completeSession = async (wordIds: string[]) => {
    const bookCode = resolveBookCode()
    if (!bookCode || wordIds.length === 0) return 0
    if (sessionTokens.value.length === 0) {
      console.warn('Skipped session completion: no session token')
      return 0
    }
    try {
      const result = await trainingAPI.completeSession(bookCode, wordIds, sessionTokens.value)
      await loadBookProgress(bookCode)
      void loadServerStats()
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
      books.value = (result.data as Book[] | undefined) || books.value
    } catch (error) {
      console.error('Failed to load books:', error)
    }
  }

  const BOOK_CODE_ALIASES: Record<string, string> = {
    kew1: 'kew1200',
    kew2: 'kew1200',
    kew3: 'kew1200',
    'kew1200-1': 'kew1200',
    'kew1200-2': 'kew1200',
    'kew1200-3': 'kew1200',
    'kew4500-1': 'kew4500',
    'kew4500-2': 'kew4500',
    'kew4500-3': 'kew4500',
    'kew4500-4': 'kew4500',
    'kew7200-1': 'kew7200',
    'kew7200-2': 'kew7200',
    'kew7200-3': 'kew7200',
    ket: 'mse-ket',
    pet: 'mse-pet',
    MSE_KET: 'mse-ket',
    MSE_PET: 'mse-pet'
  }

  const canonicalBookCode = (code: string) => BOOK_CODE_ALIASES[code] || code

  const setCurrentBook = (code: string) => {
    const next = canonicalBookCode(code)
    if (next !== currentBookCode.value) resetSessionTokens()
    currentBookCode.value = next
    uni.setStorageSync('currentBookCode', next)
  }

  const setSessionBookCode = (code?: string) => {
    const next = code ? canonicalBookCode(code) : undefined
    if (next !== sessionBookCode.value) resetSessionTokens()
    sessionBookCode.value = next
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
    const savedBook = unwrapStorage<string>(uni.getStorageSync('currentBookCode'))
      ?? (typeof uni.getStorageSync('currentBookCode') === 'string' ? uni.getStorageSync('currentBookCode') as string : '')
    const savedMeaning = unwrapStorage<MeaningType>(uni.getStorageSync('meaningType'))
    const savedSettings = unwrapStorage<StudySettings>(uni.getStorageSync('studySettings'))

    if (savedBook) {
      currentBookCode.value = canonicalBookCode(savedBook)
    } else if (!currentBookCode.value) {
      currentBookCode.value = DEFAULT_BOOK_CODE
    }
    if (savedMeaning) {
      meaningType.value = savedMeaning
    }
    if (savedSettings) {
      const rawMode = savedSettings.sessionMode as string
      const mode = rawMode === 'random' ? 'smart' : (savedSettings.sessionMode || 'smart')
      studySettings.value = {
        wordsPerGroup: savedSettings.wordsPerGroup || studySettings.value.wordsPerGroup,
        groupCount: 1,
        sessionMode: mode || 'smart'
      }
    }
  }

  const setSessionMode = (mode: SessionMode) => {
    // unit 是小学单元流专用，不写入认读记忆曲线设置
    if (mode === 'unit') return
    setStudySettings({ sessionMode: mode })
  }

  const ensureBookSelected = (): boolean => {
    if (!resolveBookCode()) {
      uni.showToast({ title: '请先选择词汇书', icon: 'none' })
      return false
    }
    return true
  }

  type PracticeType = 'listening' | 'speaking' | 'reading' | 'writing'
  type PracticeApiResult = {
    mastery?: number
    practiceCount?: number
    correctCount?: number
    due?: string
    retrievability?: number
  }
  type PendingPractice = {
    id: string
    wordId: string
    word: string
    type: PracticeType
    correct: boolean
    at: number
  }

  const PRACTICE_QUEUE_LIMIT = 500
  let practiceFlush: Promise<void> | null = null
  let lastPracticeSyncToastAt = 0

  const readPracticeQueue = (key = scopedKey('practiceQueue')): PendingPractice[] => {
    const raw = uni.getStorageSync(key)
    const list = unwrapStorage<PendingPractice[]>(raw) ?? (raw as PendingPractice[] | undefined)
    if (!Array.isArray(list)) return []
    return list.filter(item => item && item.wordId && item.type)
  }

  const writePracticeQueue = (items: PendingPractice[], key = scopedKey('practiceQueue')) => {
    if (items.length) uni.setStorageSync(key, items.slice(-PRACTICE_QUEUE_LIMIT))
    else uni.removeStorageSync(key)
  }

  const notifyPracticeSyncFailure = () => {
    const now = Date.now()
    if (now - lastPracticeSyncToastAt < 10_000) return
    lastPracticeSyncToastAt = now
    uni.showToast({ title: '学习记录暂未同步，联网后会自动重试', icon: 'none', duration: 2600 })
  }

  const ensureWordStat = (type: PracticeType, word: string) => {
    if (!stats.value[type][word]) {
      stats.value[type][word] = { count: 0, correctCount: 0, lastPractice: Date.now(), mastery: 0 }
    }
    return stats.value[type][word]
  }

  const applyPracticeResult = (event: PendingPractice, result?: PracticeApiResult | null) => {
    const entry = ensureWordStat(event.type, event.word)
    if (result) {
      entry.count = result.practiceCount ?? entry.count
      entry.correctCount = result.correctCount ?? entry.correctCount
      entry.mastery = result.mastery ?? entry.mastery
    }
    entry.lastPractice = Date.now()
  }

  /**
   * 按答题顺序串行补传，避免同一张卡片的并发写造成 FSRS 状态乱序。
   * 失败时把事件留在本地队列，下次回到前台/加载统计时继续重试。
   */
  const flushPracticeQueue = async (): Promise<void> => {
    if (practiceFlush) return practiceFlush
    const queueKey = scopedKey('practiceQueue')
    practiceFlush = (async () => {
      let queue = readPracticeQueue(queueKey)
      let synced = false
      while (queue.length) {
        const event = queue[0]
        try {
          const response = await trainingAPI.practice(event.wordId, event.type, event.correct)
          applyPracticeResult(event, response.data as PracticeApiResult | undefined)
          queue = queue.slice(1)
          writePracticeQueue(queue, queueKey)
          synced = true
        } catch (error) {
          console.error('Failed to sync practice:', error)
          notifyPracticeSyncFailure()
          break
        }
      }
      if (synced) saveStats()
    })().finally(() => {
      practiceFlush = null
    })
    return practiceFlush
  }

  const loadServerStats = async () => {
    await flushPracticeQueue()
    try {
      const result = await vocabularyAPI.stats()
      serverStats.value = (result.data as typeof serverStats.value | undefined) || serverStats.value
      serverStatsLoaded.value = true
    } catch (error) {
      console.error('Failed to load server stats:', error)
    }
  }

  const loadDailyStats = async () => {
    try {
      const goal = uni.getStorageSync('dailyGoal')
      const result = await statsAPI.daily()
      const data = result.data as typeof dailyStats.value | undefined
      if (data) {
        dailyStats.value = {
          ...data,
          goal: typeof goal === 'number' && goal > 0 ? goal : data.goal
        }
        if (dailyStats.value.goal > 0) {
          dailyStats.value.progress = Math.min(100, Math.round((dailyStats.value.wordCount / dailyStats.value.goal) * 100))
        }
      }
    } catch (error) {
      console.error('Failed to load daily stats:', error)
    }
  }

  const setSessionTopic = (topic?: string) => {
    sessionTopic.value = topic
  }

  const setSessionUnitId = (unitId?: string) => {
    sessionUnitId.value = unitId
    if (!unitId) lastSessionUnit.value = null
  }

  const loadStats = () => {
    const saved = uni.getStorageSync(scopedKey('vocabularyStats'))
    if (saved) {
      stats.value = saved
    } else {
      stats.value = emptyStats()
    }
  }

  const saveStats = () => {
    uni.setStorageSync(scopedKey('vocabularyStats'), stats.value)
  }

  const updateWordStats = async (
    wordId: string,
    word: string,
    type: PracticeType,
    correct: boolean
  ) => {
    const entry = ensureWordStat(type, word)
    // 先乐观更新本地视图；服务端返回计数后会覆盖为权威值
    entry.count++
    if (correct) entry.correctCount++
    entry.lastPractice = Date.now()
    saveStats()

    const queue = readPracticeQueue()
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      wordId,
      word,
      type,
      correct,
      at: Date.now()
    })
    writePracticeQueue(queue)
    return flushPracticeQueue()
  }

  /**
   * 跨书核对：答对掌握度 +1，答错进入待复习。返回服务端的核对结果。
   */
  const recheckWord = async (
    wordId: string,
    word: string,
    type: 'listening' | 'speaking' | 'reading' | 'writing',
    correct: boolean
  ) => {
    const bookCode = resolveBookCode()
    if (!bookCode) return null

    type RecheckApiResult = {
      mastery?: number
      practiceCount?: number
      correctCount?: number
      needsReconfirm?: boolean
      passed?: boolean
      failStreak?: number
    }
    let data: RecheckApiResult | null = null

    try {
      const result = await trainingAPI.recheck(bookCode, wordId, type, correct)
      data = (result.data as RecheckApiResult | undefined) || null
    } catch (error) {
      console.error('Failed to recheck word:', error)
      return null
    }

    if (!stats.value[type][word]) {
      stats.value[type][word] = {
        count: 0,
        correctCount: 0,
        lastPractice: Date.now(),
        mastery: 0
      }
    }
    const entry = stats.value[type][word]
    entry.count = data?.practiceCount ?? entry.count + 1
    entry.correctCount = data?.correctCount ?? entry.correctCount + (correct ? 1 : 0)
    entry.mastery = data?.mastery ?? entry.mastery
    entry.lastPractice = Date.now()
    saveStats()
    return data
  }

  const getWordMastery = (word: string, type: 'listening' | 'speaking' | 'reading' | 'writing') => {
    return stats.value[type][word]?.mastery || 0
  }

  const getWordStats = (word: string, type: 'listening' | 'speaking' | 'reading' | 'writing') => {
    return stats.value[type][word]
  }

  const getTypeStats = (type: 'listening' | 'speaking' | 'reading' | 'writing') => {
    if (serverStatsLoaded.value && serverStats.value[type]) {
      return serverStats.value[type]
    }

    const words = stats.value[type]
    const total = Object.keys(words).length
    const mastered = Object.values(words).filter(w => w.mastery >= 4).length
    const avgMastery = total > 0
      ? Math.round(Object.values(words).reduce((sum, w) => sum + w.mastery, 0) / total)
      : 0

    return { total, mastered, avgMastery }
  }

  const getDueReviewWords = async (limit: number = 20) => {
    try {
      const result = await trainingAPI.review(undefined, currentBookCode.value, limit)
      const reviewWords =
        (result.data as Array<{ word?: { word?: string } }> | undefined) || []
      return reviewWords
        .map((r: { word?: { word?: string } }) => r.word?.word)
        .filter((word): word is string => !!word)
    } catch (error) {
      console.error('Failed to get due review words:', error)
      return []
    }
  }

  const getWordsForReview = async (type: 'listening' | 'speaking' | 'reading' | 'writing', limit: number = 5) => {
    try {
      const result = await trainingAPI.review(type, currentBookCode.value, limit)
      const reviewWords =
        (result.data as Array<{ word?: { word?: string }; wordId?: string }> | undefined) || []
      return reviewWords.slice(0, limit).map(r => r.word?.word || r.wordId)
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
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
    const kept = trainingRecords.value.filter(item => item.timestamp >= cutoff)
    kept.unshift(record)
    trainingRecords.value = kept.slice(0, 5000)
    uni.setStorageSync(scopedKey('trainingRecords'), trainingRecords.value)
  }

  const loadTrainingRecords = () => {
    const saved = uni.getStorageSync(scopedKey('trainingRecords'))
    if (saved) {
      trainingRecords.value = saved
    } else {
      trainingRecords.value = []
    }
  }

  /**
   * 清空当前孩子的内存态。登出或切换孩子时必须调用。
   * clearStorage 仅用于登出，避免把刚切换到的孩子的本地缓存一起删掉。
   */
  const resetLearnerState = (options?: { clearStorage?: boolean }) => {
    vocabularyList.value = []
    stats.value = emptyStats()
    trainingRecords.value = []
    serverStats.value = {
      listening: { total: 0, mastered: 0, avgMastery: 0 },
      speaking: { total: 0, mastered: 0, avgMastery: 0 },
      reading: { total: 0, mastered: 0, avgMastery: 0 },
      writing: { total: 0, mastered: 0, avgMastery: 0 }
    }
    serverStatsLoaded.value = false
    dailyStats.value = { date: '', wordCount: 0, goal: 30, streak: 0, progress: 0 }
    bookProgress.value = null
    dueCount.value = { dueCount: 0, overdueCount: 0 }
    bookMapData.value = null
    globalMapData.value = null
    sessionTopic.value = undefined
    sessionUnitId.value = undefined
    sessionBookCode.value = undefined
    lastSessionUnit.value = null
    lastRecheckMeta.value = null
    sessionTokens.value = []
    if (options?.clearStorage) {
      uni.removeStorageSync(scopedKey('vocabularyStats'))
      uni.removeStorageSync(scopedKey('trainingRecords'))
      uni.removeStorageSync(scopedKey('practiceQueue'))
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

  const getSessionBook = computed(() => {
    const code = resolveBookCode()
    return books.value.find(b => b.code === code)
  })

  return {
    vocabularyList,
    stats,
    serverStats,
    serverStatsLoaded,
    dailyStats,
    sessionTopic,
    sessionUnitId,
    sessionBookCode,
    lastSessionUnit,
    lastRecheckMeta,
    trainingRecords,
    books,
    currentBookCode,
    meaningType,
    studySettings,
    bookProgress,
    dueCount,
    bookMapData,
    globalMapData,
    loadVocabulary,
    loadRandomVocabulary,
    loadSessionVocabulary,
    loadBookProgress,
    loadDueCount,
    loadBookMap,
    loadGlobalMap,
    completeSession,
    sessionTokens,
    addSessionToken,
    resetSessionTokens,
    setFullBookRound,
    setSessionMode,
    loadServerStats,
    loadDailyStats,
    setSessionTopic,
    setSessionUnitId,
    setSessionBookCode,
    loadStats,
    saveStats,
    flushPracticeQueue,
    updateWordStats,
    recheckWord,
    getWordMastery,
    getWordStats,
    getTypeStats,
    getWordsForReview,
    getDueReviewWords,
    addTrainingRecord,
    loadTrainingRecords,
    resetLearnerState,
    getTodayRecords,
    getTodayStats,
    loadBooks,
    setCurrentBook,
    setMeaningType,
    setStudySettings,
    loadSettings,
    ensureBookSelected,
    getCurrentBook,
    getSessionBook
  }
})
