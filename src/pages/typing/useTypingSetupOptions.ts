import { ref, type Ref } from 'vue'
import { loadTypingSource, saveTypingSource } from '@/utils/typing'
import type { Source, Summary } from './typing.types'

const SOURCES: Source[] = ['smart', 'wrong', 'favorite', 'random']
const COUNTS = [5, 10, 15, 20, 30, 40, 50]
const EXTRA_SOURCES: Array<{ key: Source; label: string }> = [
  { key: 'wrong', label: '错词' },
  { key: 'favorite', label: '收藏' },
  { key: 'random', label: '随机' }
]

/** 拼读设置页的词源、组大小和来源文案。 */
export function useTypingSetupOptions(summary: Ref<Summary | null>) {
  const savedSource = loadTypingSource()
  const source = ref<Source>(
    SOURCES.includes(savedSource as Source) ? (savedSource as Source) : 'smart'
  )
  const moreSources = ref(source.value !== 'smart')
  const allBooks = ref(false)
  const groupSize = ref(20)

  function pickSource(key: Source) {
    source.value = key
    saveTypingSource(key)
    if (key !== 'wrong' && key !== 'favorite') allBooks.value = false
  }

  function sourceLabel(item: { key: Source; label: string }) {
    if (!summary.value) return item.label
    if (allBooks.value && (item.key === 'wrong' || item.key === 'favorite')) return item.label
    if (item.key === 'wrong') return `${item.label} ${summary.value.wrong}`
    if (item.key === 'favorite') return `${item.label} ${summary.value.favorite}`
    return item.label
  }

  return {
    source,
    moreSources,
    allBooks,
    groupSize,
    counts: COUNTS,
    extraSources: EXTRA_SOURCES,
    pickSource,
    sourceLabel
  }
}
