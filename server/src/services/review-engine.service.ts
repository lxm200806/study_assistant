import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type Grade
} from 'ts-fsrs'

export type MasteryStatus = 'mastered' | 'learning' | 'unfamiliar' | 'unpracticed'
export type WeakReason = 'overdue' | 'low_retention' | 'recent_lapse'
export type FsrsStateName = 'New' | 'Learning' | 'Review' | 'Relearning'

export const MIN_REPS_FOR_MASTERED = 3
export const RETRIEVABILITY_MASTERED = 0.85
export const RETRIEVABILITY_WEAK = 0.75

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ['10m', '1d'],
  relearning_steps: ['10m']
})

export interface FsrsStatFields {
  practiceCount: number
  correctCount: number
  mastery: number
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
}

export interface VocabularyStatInput {
  practiceCount?: number
  correctCount?: number
  due?: Date | null
  stability?: number
  difficulty?: number
  reps?: number
  lapses?: number
  fsrsState?: string
  lastReview?: Date | null
  lastPractice?: Date | null
  retrievability?: number
  recentLapse?: boolean
}

const STATE_NAMES: Record<State, FsrsStateName> = {
  [State.New]: 'New',
  [State.Learning]: 'Learning',
  [State.Review]: 'Review',
  [State.Relearning]: 'Relearning'
}

const STATE_FROM_NAME: Record<FsrsStateName, State> = {
  New: State.New,
  Learning: State.Learning,
  Review: State.Review,
  Relearning: State.Relearning
}

export function stateToName(state: State): FsrsStateName {
  return STATE_NAMES[state] ?? 'New'
}

export function nameToState(name: string): State {
  return STATE_FROM_NAME[name as FsrsStateName] ?? State.New
}

export function statToCard(stat: VocabularyStatInput, now: Date = new Date()): Card {
  if (!stat.practiceCount || stat.practiceCount === 0) {
    return createEmptyCard(now)
  }

  return {
    due: stat.due ?? now,
    stability: stat.stability ?? 0,
    difficulty: stat.difficulty ?? 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: stat.reps ?? 0,
    lapses: stat.lapses ?? 0,
    state: nameToState(stat.fsrsState ?? 'New'),
    last_review: stat.lastReview ?? stat.lastPractice ?? undefined
  }
}

export function cardToStatFields(card: Card, now: Date = new Date()): Pick<
  FsrsStatFields,
  'due' | 'stability' | 'difficulty' | 'reps' | 'lapses' | 'fsrsState' | 'lastReview' | 'retrievability'
> {
  const retrievability = computeRetrievability(card, now)
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    fsrsState: stateToName(card.state),
    lastReview: card.last_review ?? now,
    retrievability
  }
}

export function computeRetrievability(card: Card, now: Date = new Date()): number {
  if (card.state === State.New || card.reps === 0) {
    return 0
  }
  return scheduler.get_retrievability(card, now, false)
}

export function computeDisplayMastery(reps: number, retrievability: number): number {
  const depth = Math.min(1, reps / MIN_REPS_FOR_MASTERED)
  return Math.min(5, Math.max(0, Math.round(retrievability * depth * 5)))
}

export function mapAnswerToRating(
  isCorrect: boolean,
  stat: VocabularyStatInput
): Grade {
  if (!isCorrect) return Rating.Again
  if (stat.recentLapse) return Rating.Hard
  const reps = stat.reps ?? 0
  if (reps >= 2) return Rating.Easy
  return Rating.Good
}

export function getMasteryStatus(
  stat: Pick<FsrsStatFields, 'practiceCount' | 'reps' | 'retrievability' | 'due' | 'fsrsState'>,
  now: Date = new Date()
): MasteryStatus {
  if (stat.practiceCount === 0 || stat.reps === 0) {
    return 'unpracticed'
  }

  const overdue = stat.due != null && stat.due.getTime() <= now.getTime()
  const lowRetention = stat.retrievability < RETRIEVABILITY_WEAK
  const relearning = stat.fsrsState === 'Relearning'

  if (overdue || lowRetention || relearning) {
    return 'unfamiliar'
  }

  const mastered =
    stat.reps >= MIN_REPS_FOR_MASTERED &&
    stat.retrievability >= RETRIEVABILITY_MASTERED &&
    stat.fsrsState === 'Review' &&
    stat.due != null &&
    stat.due.getTime() > now.getTime()

  if (mastered) return 'mastered'
  return 'learning'
}

export function getWeakReason(
  stat: Pick<FsrsStatFields, 'practiceCount' | 'due' | 'retrievability' | 'fsrsState' | 'recentLapse'>,
  now: Date = new Date()
): WeakReason | undefined {
  if (stat.practiceCount === 0) return undefined

  if (stat.recentLapse || stat.fsrsState === 'Relearning') {
    return 'recent_lapse'
  }
  if (stat.due != null && stat.due.getTime() <= now.getTime()) {
    return 'overdue'
  }
  if (stat.retrievability < RETRIEVABILITY_WEAK) {
    return 'low_retention'
  }
  return undefined
}

export function processPractice(
  stat: VocabularyStatInput,
  isCorrect: boolean,
  now: Date = new Date()
): FsrsStatFields {
  const card = statToCard(stat, now)
  const rating = mapAnswerToRating(isCorrect, stat)
  const { card: nextCard } = scheduler.next(card, now, rating)

  const practiceCount = (stat.practiceCount ?? 0) + 1
  const correctCount = (stat.correctCount ?? 0) + (isCorrect ? 1 : 0)
  const fsrsFields = cardToStatFields(nextCard, now)
  const recentLapse = !isCorrect
  const mastery = computeDisplayMastery(fsrsFields.reps, fsrsFields.retrievability)

  return {
    practiceCount,
    correctCount,
    mastery,
    ...fsrsFields,
    lastPractice: now,
    recentLapse
  }
}

export function buildFsrsFieldsFromStat(
  stat: VocabularyStatInput,
  now: Date = new Date()
): FsrsStatFields {
  const card = statToCard(stat, now)
  const retrievability = computeRetrievability(card, now)
  const reps = stat.reps ?? card.reps
  return {
    practiceCount: stat.practiceCount ?? 0,
    correctCount: stat.correctCount ?? 0,
    mastery: computeDisplayMastery(reps, retrievability),
    due: stat.due ?? card.due,
    stability: stat.stability ?? card.stability,
    difficulty: stat.difficulty ?? card.difficulty,
    reps,
    lapses: stat.lapses ?? card.lapses,
    fsrsState: stat.fsrsState ?? stateToName(card.state),
    lastReview: stat.lastReview ?? card.last_review ?? null,
    lastPractice: stat.lastPractice ?? null,
    retrievability,
    recentLapse: stat.recentLapse ?? false
  }
}

export function computeWeakPriorityScore(
  stat: FsrsStatFields,
  now: Date = new Date()
): number {
  if (stat.practiceCount === 0) return 500

  const overdueMs = stat.due ? Math.max(0, now.getTime() - stat.due.getTime()) : 0
  const overdueDays = overdueMs / (1000 * 60 * 60 * 24)
  return (
    overdueDays * 100 +
    (1 - stat.retrievability) * 80 +
    (5 - stat.mastery) * 20
  )
}

export function replayPracticeHistory(
  records: { isCorrect: boolean; createdAt: Date }[],
  now: Date = new Date()
): FsrsStatFields {
  let stat: VocabularyStatInput = {
    practiceCount: 0,
    correctCount: 0,
    reps: 0,
    lapses: 0,
    fsrsState: 'New',
    recentLapse: false
  }

  for (const record of records) {
    stat = processPractice(stat, record.isCorrect, record.createdAt)
  }

  if (records.length === 0) {
    return buildFsrsFieldsFromStat(stat, now)
  }

  return buildFsrsFieldsFromStat(stat, records[records.length - 1].createdAt)
}

export function initializeFromAggregates(
  practiceCount: number,
  correctCount: number,
  now: Date = new Date()
): FsrsStatFields {
  if (practiceCount <= 0) {
    return buildFsrsFieldsFromStat({ practiceCount: 0, correctCount: 0 }, now)
  }

  const records = Array.from({ length: practiceCount }, (_, i) => ({
    isCorrect: i < correctCount,
    createdAt: new Date(now.getTime() - (practiceCount - i) * 86400000)
  }))

  return replayPracticeHistory(records, now)
}

export { scheduler }
