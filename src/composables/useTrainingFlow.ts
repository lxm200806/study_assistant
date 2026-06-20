import { ref } from 'vue'
import type { Vocabulary } from '@/types'
import { useVocabularyStore } from '@/stores/vocabulary'

export function useTrainingFlow(trainingType: 'listening' | 'speaking' | 'reading' | 'writing') {
  const vocabStore = useVocabularyStore()
  const allSessionWords = ref<Vocabulary[]>([])
  const newlyCovered = ref(0)

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
  }

  const loadGroup = async (count: number) => {
    await vocabStore.loadSessionVocabulary(count, trainingType)
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
    resetFlow,
    loadGroup,
    finishSession
  }
}
