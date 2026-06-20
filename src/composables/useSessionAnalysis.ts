import { ref } from 'vue'
import type { TrainingType, SessionWordResult } from '@/utils/mastery'
import { buildSessionAnalysis, wordStatsToSessionResult } from '@/utils/mastery'
import type { Vocabulary } from '@/types'
import { getWordMeaning } from '@/utils/vocabulary'
import type { MeaningType } from '@/types'

export function useSessionAnalysis(trainingType: TrainingType) {
  const sessionResults = ref<SessionWordResult[]>([])
  const previousMastery = ref<Record<string, number>>({})

  const recordAnswer = (
    word: Vocabulary,
    correct: boolean,
    getStats: (word: string) => { count: number; correctCount: number; mastery: number } | undefined,
    meaningType: MeaningType
  ) => {
    if (!previousMastery.value[word.word]) {
      previousMastery.value[word.word] = getStats(word.word)?.mastery || 0
    }

    const stats = getStats(word.word)
    const result = wordStatsToSessionResult(
      word.word,
      getWordMeaning(word, meaningType),
      correct,
      stats
    )

    const idx = sessionResults.value.findIndex(r => r.word === word.word)
    if (idx >= 0) {
      sessionResults.value[idx] = result
    } else {
      sessionResults.value.push(result)
    }
  }

  const getAnalysis = () => {
    return buildSessionAnalysis(sessionResults.value, previousMastery.value)
  }

  const resetSession = () => {
    sessionResults.value = []
    previousMastery.value = {}
  }

  return {
    sessionResults,
    recordAnswer,
    getAnalysis,
    resetSession
  }
}
