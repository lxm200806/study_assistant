import { ref } from 'vue'
import type { Vocabulary } from '@/types'
import type { SessionMode, SessionUnitMeta } from '@/types/map'
import { useVocabularyStore } from '@/stores/vocabulary'

export function useTrainingFlow(trainingType: 'listening' | 'speaking' | 'reading' | 'writing') {
  const vocabStore = useVocabularyStore()
  const allSessionWords = ref<Vocabulary[]>([])
  const newlyCovered = ref(0)
  const unitMeta = ref<SessionUnitMeta | null>(null)

  const trackWords = (wordList: Vocabulary[]) => {
    for (const word of wordList) {
      if (!allSessionWords.value.find(w => w.id === word.id)) {
        allSessionWords.value.push(word)
      }
    }
  }

  const resetFlow = () => {
    allSessionWords.value = []
    newlyCovered.value = 0
    unitMeta.value = null
    vocabStore.resetSessionTokens()
  }

  const loadGroup = async (
    count: number,
    opts?: { mode?: SessionMode; unit?: string; excludeSeen?: boolean }
  ) => {
    const excludeIds =
      opts?.excludeSeen === false
        ? undefined
        : opts?.mode === 'unit' || opts?.unit
          ? allSessionWords.value.map(w => w.id)
          : undefined
    await vocabStore.loadSessionVocabulary(count, trainingType, undefined, {
      mode: opts?.mode,
      unit: opts?.unit,
      excludeIds
    })
    unitMeta.value = vocabStore.lastSessionUnit
    trackWords(vocabStore.vocabularyList)
    return vocabStore.vocabularyList
  }

  const finishSession = async () => {
    newlyCovered.value = await vocabStore.completeSession(
      allSessionWords.value.map(w => w.id)
    )
  }

  return {
    allSessionWords,
    newlyCovered,
    unitMeta,
    resetFlow,
    loadGroup,
    finishSession
  }
}
