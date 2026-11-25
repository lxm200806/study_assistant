import { computed, ref, type Ref } from 'vue'
import { typingAPI } from '@/utils/api'
import { useVocabularyStore } from '@/stores/vocabulary'
import type { ArticleRow, Summary, WordMode } from './typing.types'

export interface TypingHistory {
  days: Array<{ date: string; items: number; level: number }>
  speed: Array<{ at: string; charsPerMinute: number; items: number }>
}

/** 拼读设置页的统计、短文列表和练习历史加载。 */
export function useTypingSetup(wordMode: Ref<WordMode>) {
  const vocabStore = useVocabularyStore()
  const summary = ref<Summary | null>(null)
  const articles = ref<ArticleRow[]>([])
  const historyLoaded = ref(false)
  const history = ref<TypingHistory>({ days: [], speed: [] })

  const hasHistory = computed(
    () => history.value.days.some(day => day.items > 0) || history.value.speed.length > 0
  )
  const maxSpeed = computed(() =>
    history.value.speed.reduce((max, point) => Math.max(max, point.charsPerMinute), 0)
  )

  async function refreshSummary() {
    if (!vocabStore.currentBookCode) return
    try {
      const result = await typingAPI.summary(vocabStore.currentBookCode, wordMode.value)
      summary.value = (result.data as Summary) || null
    } catch {
      summary.value = null
    }
  }

  async function refreshArticles() {
    try {
      const result = await typingAPI.articles()
      articles.value = (result.data as ArticleRow[]) || []
    } catch {
      articles.value = []
    }
  }

  function localDate() {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${now.getFullYear()}-${month}-${day}`
  }

  function barHeight(speed: number) {
    const top = Math.max(maxSpeed.value, 1)
    return `${Math.max(8, Math.round((speed / top) * 100))}%`
  }

  async function refreshHistory() {
    try {
      const result = await typingAPI.history(localDate())
      const data = result.data as TypingHistory
      history.value = {
        days: data?.days || [],
        speed: data?.speed || []
      }
    } catch {
      history.value = { days: [], speed: [] }
    } finally {
      historyLoaded.value = true
    }
  }

  return {
    summary,
    articles,
    historyLoaded,
    history,
    hasHistory,
    maxSpeed,
    refreshSummary,
    refreshArticles,
    refreshHistory,
    localDate,
    barHeight
  }
}
