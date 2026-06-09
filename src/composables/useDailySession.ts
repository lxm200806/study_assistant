import { useVocabularyStore } from '@/stores/vocabulary'
import { DEFAULTS } from '@/config/defaults'
import { openPage } from '@/utils/navigation'
import { isBookAccessible } from '@/composables/useTrainingStart'

export interface DailySessionPlan {
  wordCount: number
  dueCount: number
  sessionMode: 'smart' | 'review'
  trainingType: 'reading' | 'listening' | 'writing' | 'speaking'
}

export function useDailySession() {
  const vocabStore = useVocabularyStore()

  const getDailyGoal = (): number => {
    const saved = uni.getStorageSync('dailyGoal')
    const unwrapped = typeof saved === 'object' && saved?.data != null ? saved.data : saved
    return typeof unwrapped === 'number' && unwrapped > 0 ? unwrapped : 30
  }

  const ensureAccessibleBook = (): boolean => {
    const book = vocabStore.getCurrentBook
    if (book && isBookAccessible(book.code, book.isFree)) {
      return true
    }
    vocabStore.setCurrentBook(DEFAULTS.BOOK_CODE)
    uni.showToast({ title: '已切换到免费 KET 词书', icon: 'none' })
    return true
  }

  const prepareDailySession = async (): Promise<DailySessionPlan> => {
    ensureAccessibleBook()
    await vocabStore.loadDueCount(vocabStore.currentBookCode, 'reading')
    const due = vocabStore.dueCount.dueCount
    const goal = getDailyGoal()
    const wordCount = Math.min(Math.max(due || 10, 10), goal)

    vocabStore.setSessionMode(due > 0 ? 'review' : 'smart')
    vocabStore.setStudySettings({
      wordsPerGroup: Math.min(wordCount, 20),
      groupCount: 1
    })

    return {
      wordCount,
      dueCount: due,
      sessionMode: due > 0 ? 'review' : 'smart',
      trainingType: 'reading'
    }
  }

  const startDailyTraining = async (type: DailySessionPlan['trainingType'] = 'reading') => {
    if (!vocabStore.ensureBookSelected()) return
    if (!ensureAccessibleBook()) return
    await prepareDailySession()
    const pages: Record<string, string> = {
      reading: '/pages/recognition/recognition',
      listening: '/pages/listening/listening',
      writing: '/pages/spelling/spelling',
      speaking: '/pages/speaking/speaking'
    }
    openPage(`${pages[type]}?autoStart=1`)
  }

  return {
    getDailyGoal,
    ensureAccessibleBook,
    prepareDailySession,
    startDailyTraining
  }
}
