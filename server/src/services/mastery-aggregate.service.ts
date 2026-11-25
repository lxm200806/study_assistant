import type { WordType } from '../types'
import {
  getMasteryStatus as deriveMasteryStatus,
  getWeakReason,
  buildFsrsFieldsFromStat,
  computeWeakPriorityScore,
  type MasteryStatus,
  type WeakReason
} from './review-engine.service'

export type { MasteryStatus, WeakReason }

const WORD_TYPES: WordType[] = ['listening', 'speaking', 'reading', 'writing']

export function getMasteryStatus(
  mastery: number,
  practiced: boolean,
  stat?: {
    practiceCount?: number
    reps?: number
    retrievability?: number
    due?: Date | null
    fsrsState?: string
    recentLapse?: boolean
  }
): MasteryStatus {
  if (stat) {
    return deriveMasteryStatus(buildFsrsFieldsFromStat(stat))
  }

  if (!practiced || mastery === 0) return 'unpracticed'
  if (mastery >= 4) return 'mastered'
  if (mastery >= 2) return 'learning'
  return 'unfamiliar'
}

export interface WordStatEntry {
  wordId: string
  type: WordType
  practiceCount: number
  correctCount: number
  mastery: number
  lastPractice: Date | null
  due?: Date | null
  stability?: number
  difficulty?: number
  reps?: number
  lapses?: number
  fsrsState?: string
  lastReview?: Date | null
  retrievability?: number
  recentLapse?: boolean
  /** 跨书核对未通过：算练过，但掌握度按待复习处理。 */
  needsReconfirm?: boolean
  weakReason?: WeakReason
}

export type SkillView = 'none' | 'recognize' | 'write' | 'partial' | 'mastered'

export interface AggregatedWordMastery {
  wordId: string
  mastery: number
  practiced: boolean
  practiceCount: number
  needsReconfirm: boolean
  byType: Partial<Record<WordType | 'recognize' | 'write', number>>
  recognize: number | null
  write: number | null
  skill: SkillView
  skillLabel: string
  lastPractice: Date | null
  retrievability?: number
  due?: Date | null
  fsrsState?: string
}

function practicedMastery(stat: WordStatEntry | undefined): number | null {
  if (!stat || stat.practiceCount <= 0) return null
  if (stat.needsReconfirm) return 0
  return stat.mastery
}

/** 是否练过。指定 type 时只认该技能，避免「别的书练过认读」把拼写也当成已学。 */
export function practicedForType(stats: WordStatEntry[], type?: string): boolean {
  if (!type) return stats.some(s => s.practiceCount > 0)
  return stats.some(s => s.type === type && s.practiceCount > 0)
}

/** 认识 = 认读（没有认读记录时用听力兜底）。会写 = 拼写。总览取更弱的一项。 */
export function skillSnapshot(stats: WordStatEntry[]) {
  const reading = practicedMastery(stats.find(s => s.type === 'reading'))
  const listening = practicedMastery(stats.find(s => s.type === 'listening'))
  const writing = practicedMastery(stats.find(s => s.type === 'writing'))
  const needsReconfirm = stats.some(s => s.practiceCount > 0 && s.needsReconfirm === true)
  const recognize = reading ?? listening
  const write = writing
  const recognizeOk = recognize != null && recognize >= 4
  const writeOk = write != null && write >= 4

  const settle = <T extends {
    recognize: number | null
    write: number | null
    mastery: number
    practiced: boolean
    skill: SkillView
    skillLabel: string
  }>(snapshot: T): T & { needsReconfirm: boolean } => {
    if (!needsReconfirm) return { ...snapshot, needsReconfirm: false }
    return {
      ...snapshot,
      mastery: 0,
      skill: snapshot.skill === 'mastered' ? 'partial' : snapshot.skill,
      skillLabel: `${snapshot.skillLabel}（待核对）`,
      needsReconfirm: true
    }
  }

  if (recognize == null && write == null) {
    return settle({ recognize, write, mastery: 0, practiced: false, skill: 'none' as SkillView, skillLabel: '未练习' })
  }
  if (recognizeOk && writeOk) {
    return settle({
      recognize,
      write,
      mastery: Math.min(recognize!, write!),
      practiced: true,
      skill: 'mastered' as SkillView,
      skillLabel: '认识且会写'
    })
  }
  if (recognize != null && write != null) {
    return settle({
      recognize,
      write,
      mastery: Math.min(recognize, write),
      practiced: true,
      skill: 'partial' as SkillView,
      skillLabel: '两项都练过'
    })
  }
  if (recognize != null) {
    return settle({ recognize, write, mastery: recognize, practiced: true, skill: 'recognize' as SkillView, skillLabel: '只会认' })
  }
  return settle({ recognize, write, mastery: write!, practiced: true, skill: 'write' as SkillView, skillLabel: '只会写' })
}

export function aggregateWordMastery(stats: WordStatEntry[]): AggregatedWordMastery | null {
  if (stats.length === 0) return null

  const wordId = stats[0].wordId
  const byType: Partial<Record<WordType | 'recognize' | 'write', number>> = {}
  let totalPractice = 0
  let lastPractice: Date | null = null
  let lowestRetrievability = 1
  let earliestDue: Date | null = null
  let primaryState = 'New'

  for (const stat of stats) {
    byType[stat.type] = stat.needsReconfirm ? 0 : stat.mastery
    totalPractice += stat.practiceCount
    if (stat.lastPractice && (!lastPractice || stat.lastPractice > lastPractice)) {
      lastPractice = stat.lastPractice
    }
    if ((stat.retrievability ?? 1) < lowestRetrievability) {
      lowestRetrievability = stat.retrievability ?? 1
      primaryState = stat.fsrsState ?? 'New'
      earliestDue = stat.due ?? null
    }
  }

  const skill = skillSnapshot(stats)
  if (skill.recognize != null) byType.recognize = skill.recognize
  if (skill.write != null) byType.write = skill.write

  return {
    wordId,
    mastery: skill.mastery,
    practiced: skill.practiced,
    practiceCount: totalPractice,
    byType,
    recognize: skill.recognize,
    write: skill.write,
    skill: skill.skill,
    skillLabel: skill.skillLabel,
    needsReconfirm: skill.needsReconfirm,
    lastPractice,
    retrievability: skill.practiced ? lowestRetrievability : 0,
    due: earliestDue,
    fsrsState: primaryState
  }
}

export function aggregateBookWordStats(
  wordIds: string[],
  statsByWordId: Map<string, WordStatEntry[]>
): Map<string, AggregatedWordMastery> {
  const result = new Map<string, AggregatedWordMastery>()

  for (const wordId of wordIds) {
    const stats = statsByWordId.get(wordId) || []
    const aggregated = aggregateWordMastery(stats)
    result.set(wordId, aggregated || {
      wordId,
      mastery: 0,
      practiced: false,
      practiceCount: 0,
      byType: {},
      recognize: null,
      write: null,
      skill: 'none',
      skillLabel: '未练习',
      needsReconfirm: false,
      lastPractice: null
    })
  }

  return result
}

export function getPriorityScore(
  mastery: AggregatedWordMastery,
  inCurrentCycle: boolean,
  typeStat?: WordStatEntry
): number {
  if (typeStat) {
    return computeWeakPriorityScore(buildFsrsFieldsFromStat(typeStat))
  }

  if (!mastery.practiced) return 1000
  if (mastery.mastery < 2) return 800 - mastery.mastery * 50
  if (mastery.mastery < 4) return 400 - mastery.mastery * 30
  if (inCurrentCycle) return 50
  return 200 - mastery.mastery * 10
}

export function buildTypeStatsFromEntry(entry?: WordStatEntry) {
  if (!entry || entry.practiceCount <= 0) {
    return {
      practiceCount: 0,
      correctCount: 0,
      mastery: 0,
      accuracy: 0,
      due: null as Date | null,
      retrievability: 0,
      reps: 0,
      lapses: 0,
      fsrsState: 'New' as const,
      weakReason: undefined as WeakReason | undefined
    }
  }

  const fields = buildFsrsFieldsFromStat(entry)
  return {
    practiceCount: entry.practiceCount,
    correctCount: entry.correctCount,
    mastery: entry.needsReconfirm ? 0 : fields.mastery,
    accuracy: Math.round((entry.correctCount / entry.practiceCount) * 100),
    due: fields.due,
    retrievability: fields.retrievability,
    reps: fields.reps,
    lapses: fields.lapses,
    fsrsState: fields.fsrsState,
    weakReason: getWeakReason(fields)
  }
}

export { WORD_TYPES, getWeakReason }
