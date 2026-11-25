import { processPractice, type FsrsStatFields, type VocabularyStatInput } from './review-engine.service'

/** Schedule one keyboard card. Callers keep word-mode rows and sentence rows in different tables. */
export function scheduleCard(
  card: VocabularyStatInput,
  isCorrect: boolean,
  now: Date = new Date()
): FsrsStatFields {
  return processPractice(card, isCorrect, now)
}

export function cardInputFrom(row: {
  practiceCount: number
  correctCount: number
  due: Date | null
  stability: number
  difficulty: number
  reps: number
  lapses: number
  fsrsState: string
  lastReview: Date | null
  lastPractice: Date | null
  retrievability: number
  recentLapse: boolean
  learningSteps: number
  scheduledDays: number
}): VocabularyStatInput {
  return {
    practiceCount: row.practiceCount,
    correctCount: row.correctCount,
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    reps: row.reps,
    lapses: row.lapses,
    fsrsState: row.fsrsState,
    lastReview: row.lastReview,
    lastPractice: row.lastPractice,
    retrievability: row.retrievability,
    recentLapse: row.recentLapse,
    learningSteps: row.learningSteps,
    scheduledDays: row.scheduledDays
  }
}
