import type { Ref } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import { TOPIC_LABELS } from '@/types/map'

export function useGroupComplete(deps: {
  finishSession: () => Promise<void>
  nextGroupTraining: () => Promise<void>
  showFinish: Ref<boolean>
  showResult: Ref<boolean>
  finishDueCount?: Ref<number>
  weakTopicLabels?: Ref<string[]>
  onAfterNextGroup?: () => void
}) {
  const vocabStore = useVocabularyStore()

  const loadFinishMeta = async () => {
    await vocabStore.loadDueCount()
    await vocabStore.loadBookMap()
    if (deps.finishDueCount) {
      deps.finishDueCount.value = vocabStore.dueCount.dueCount
    }
    if (deps.weakTopicLabels) {
      deps.weakTopicLabels.value = (vocabStore.bookMapData?.weakestTopics || []).map(
        (t: string) => TOPIC_LABELS[t as keyof typeof TOPIC_LABELS] || t
      )
    }
  }

  const completeAndNextGroup = async () => {
    await deps.finishSession()
    await vocabStore.loadBookProgress()
    deps.showResult.value = false
    await deps.nextGroupTraining()
    deps.onAfterNextGroup?.()
  }

  const completeAndFinish = async () => {
    await deps.finishSession()
    await loadFinishMeta()
    deps.showResult.value = false
    deps.showFinish.value = true
  }

  return { completeAndNextGroup, completeAndFinish }
}
