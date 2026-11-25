import prisma from '../prisma/client'
import { startOfToday, todayKey } from '../utils/date-key'
import { formatBookWord } from '../utils/wordFormat'
import {
  aggregateBookWordStats,
  getPriorityScore,
  getMasteryStatus,
  practicedForType,
  type WordStatEntry
} from './mastery-aggregate.service'
import {
  buildFsrsFieldsFromStat,
  computeWeakPriorityScore,
  getWeakReason
} from './review-engine.service'
import { pickSmartQueue, stableUnit, type SmartQueueCandidate } from './smart-queue'
import { getBookByCode } from './book.service'
import { pickRecheckCandidates } from './recheck-queue'
import { runSerializable } from '../prisma/tx'
import { recordDailyStudyInTx } from './daily-study.service'
import type { Prisma } from '@prisma/client'

export type SessionMode = 'coverage' | 'smart' | 'weak' | 'review' | 'unit' | 'recheck'

export interface BookProgressInfo {
  bookCode: string
  wordCount: number
  practicedCount: number
  coverageRate: number
  cycleRemaining: number
  cyclePracticedCount: number
}

export async function getBookProgress(userId: string, bookCode: string): Promise<BookProgressInfo> {
  const book = await getBookByCode(bookCode)
  if (!book) {
    throw new Error('Book not found')
  }

  const wordIds = book.vocabulary.map(bv => bv.wordId)
  const stats = await loadUserWordStats(userId, wordIds)
  const aggregated = aggregateBookWordStats(wordIds, stats)

  const practicedCount = [...aggregated.values()].filter(m => m.practiced).length
  const progress = await prisma.bookStudyProgress.findUnique({
    where: { learnerId_bookId: { learnerId: userId, bookId: book.id } }
  })
  const cycleSet = new Set(progress?.practicedWordIds || [])
  // 全局已练过的词视为本书也已覆盖，避免 KET→PET 重复「新学」
  for (const [wordId, mastery] of aggregated) {
    if (mastery.practiced) cycleSet.add(wordId)
  }
  const cyclePracticed = cycleSet.size

  return {
    bookCode,
    wordCount: wordIds.length,
    practicedCount,
    coverageRate: wordIds.length > 0 ? Math.round((practicedCount / wordIds.length) * 100) : 0,
    cycleRemaining: Math.max(0, wordIds.length - cyclePracticed),
    cyclePracticedCount: cyclePracticed
  }
}

async function loadUserWordStats(userId: string, wordIds: string[]): Promise<Map<string, WordStatEntry[]>> {
  const stats = await prisma.vocabularyStat.findMany({
    where: { learnerId: userId, wordId: { in: wordIds } }
  })

  const map = new Map<string, WordStatEntry[]>()
  for (const stat of stats) {
    const list = map.get(stat.wordId) || []
    list.push({
      wordId: stat.wordId,
      type: stat.type as WordStatEntry['type'],
      practiceCount: stat.practiceCount,
      correctCount: stat.correctCount,
      mastery: stat.mastery,
      lastPractice: stat.lastPractice,
      due: stat.due,
      stability: stat.stability,
      difficulty: stat.difficulty,
      reps: stat.reps,
      lapses: stat.lapses,
      fsrsState: stat.fsrsState,
      lastReview: stat.lastReview,
      retrievability: stat.retrievability,
      recentLapse: stat.recentLapse,
      needsReconfirm: stat.needsReconfirm
    })
    map.set(stat.wordId, list)
  }
  return map
}

function getTypeStat(
  statsMap: Map<string, WordStatEntry[]>,
  wordId: string,
  trainingType?: string
): WordStatEntry | undefined {
  if (!trainingType) return undefined
  return statsMap.get(wordId)?.find(s => s.type === trainingType)
}

function computeScore(
  bvWordId: string,
  statsMap: Map<string, WordStatEntry[]>,
  aggregated: ReturnType<typeof aggregateBookWordStats> extends Map<string, infer V> ? V : never,
  inCycle: boolean,
  mode: SessionMode,
  trainingType?: string
): number {
  const typeStat = getTypeStat(statsMap, bvWordId, trainingType)
  const now = new Date()

  if (mode === 'weak' || mode === 'review') {
    if (typeStat) {
      return computeWeakPriorityScore(buildFsrsFieldsFromStat(typeStat, now))
    }
    if (!aggregated.practiced) return 500
    return getPriorityScore(aggregated, inCycle)
  }

  return getPriorityScore(aggregated, inCycle, typeStat)
}

/** 智能组卷的紧迫度权重，全部按“小时 / 记忆保持率 / 新词”解释，避免不可读的魔法数。 */
const SMART_DUE_BASE = 2000
const SMART_OVERDUE_HOURS_CAP = 24 * 14
const SMART_OVERDUE_HOUR_WEIGHT = 3
const SMART_NEW_BASE = 600
const SMART_NEW_NOT_IN_CYCLE = 800
const SMART_MASTERED_PENALTY = 1500
const SMART_FORGETTING_WEIGHT = 300
const SMART_WEAK_BONUS = 200
const SMART_LAPSE_WEIGHT = 30
const SMART_LAPSE_CAP = 180
const SMART_DAILY_NEW_CAP = 20
const SMART_JITTER = 10

function computeSmartScore(
  userId: string,
  bvWordId: string,
  statsMap: Map<string, WordStatEntry[]>,
  aggregated: ReturnType<typeof aggregateBookWordStats> extends Map<string, infer V> ? V : never,
  practiced: boolean,
  inCycle: boolean,
  trainingType: string | undefined,
  dayKey: string
): number {
  const typeStat = getTypeStat(statsMap, bvWordId, trainingType)
  const now = new Date()
  const fsrs = typeStat ? buildFsrsFieldsFromStat(typeStat, now) : null
  const due = fsrs?.due != null && fsrs.due.getTime() <= now.getTime()
  const overdueHours = due ? (now.getTime() - fsrs!.due!.getTime()) / 3_600_000 : 0
  const overdueUrgency = Math.min(SMART_OVERDUE_HOURS_CAP, overdueHours) * SMART_OVERDUE_HOUR_WEIGHT
  const forgetting = fsrs ? (1 - fsrs.retrievability) * SMART_FORGETTING_WEIGHT : 0
  const weakBonus = fsrs && getWeakReason(fsrs, now) ? SMART_WEAK_BONUS : 0
  const lapsePenalty = fsrs ? Math.min(SMART_LAPSE_CAP, fsrs.lapses * SMART_LAPSE_WEIGHT) : 0

  let score = getPriorityScore(aggregated, inCycle, typeStat)

  if (due) {
    score += SMART_DUE_BASE + overdueUrgency
  }

  // 生词优先；其它书已学过且未到期 → 大幅降权，不当新学刷
  if (!practiced) {
    score += SMART_NEW_BASE
    if (!inCycle) score += SMART_NEW_NOT_IN_CYCLE
  } else if (!due) {
    score -= SMART_MASTERED_PENALTY
  }

  // 同一天同一用户的顺序稳定，跨天再变化，避免每次刷新都换一批词。
  return score + forgetting + weakBonus - lapsePenalty + stableUnit(`${dayKey}:${userId}:${bvWordId}`) * SMART_JITTER
}

/** 当天已练过的不同词数，用作新词额度的保守近似（复习词也会占用额度）。 */
async function countPracticedWordsToday(userId: string, trainingType?: string): Promise<number> {
  if (!trainingType) return 0
  const rows = await prisma.trainingRecord.findMany({
    where: {
      learnerId: userId,
      type: trainingType,
      createdAt: { gte: startOfToday() }
    },
    select: { wordId: true },
    distinct: ['wordId']
  })
  return rows.length
}

function normalizeUnitId(unitId: string): string {
  const raw = unitId.trim()
  if (!raw) return ''
  return raw.startsWith('u') ? raw : `u${raw}`
}

/** 优先用课表 units.json 的词序；没有课表时再退回标签。 */
function resolveUnitBookWords<T extends { wordId: string; word: { word: string; tags?: string[] } }>(
  bookCode: string,
  bookWordsAll: T[],
  unitId: string
): T[] {
  const uid = normalizeUnitId(unitId)
  try {
    // lazy require，避免 coverage 被前端无关路径拖进课表脚本
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadCurriculumBook } = require('../../scripts/vocabulary-import/curriculum') as {
      loadCurriculumBook: (code: string) => {
        units: Array<{ id: string; words: string[] }>
      }
    }
    const curriculum = loadCurriculumBook(bookCode)
    const unit = curriculum.units.find(u => normalizeUnitId(u.id) === uid)
    if (unit?.words?.length) {
      const bySpelling = new Map(bookWordsAll.map(bv => [bv.word.word.trim().toLowerCase(), bv] as const))
      const ordered: T[] = []
      const seen = new Set<string>()
      for (const raw of unit.words) {
        const key = raw.trim().toLowerCase()
        const hit = bySpelling.get(key)
        if (!hit || seen.has(hit.wordId)) continue
        seen.add(hit.wordId)
        ordered.push(hit)
      }
      if (ordered.length) return ordered
    }
  } catch {
    /* no units file */
  }

  const tag = `kew-unit:${uid}`
  return bookWordsAll.filter(bv => (bv.word.tags || []).includes(tag))
}

export async function getSessionWords(
  userId: string,
  bookCode: string,
  count: number,
  mode: SessionMode = 'coverage',
  trainingType?: string,
  topic?: string,
  opts?: { unitId?: string; excludeIds?: string[] }
) {
  if ((mode as string) === 'random') {
    mode = 'smart'
  }
  const book = await getBookByCode(bookCode)
  if (!book) {
    throw new Error('Book not found')
  }

  const bookWordsAll = book.vocabulary.sort((a, b) => a.sortOrder - b.sortOrder)
  const unitId = (opts?.unitId || '').trim()
  const excludeSet = new Set((opts?.excludeIds || []).filter(Boolean))

  // 单元顺序学：与记忆曲线队列分开，按教材单元词序切片
  if (mode === 'unit') {
    if (!unitId) {
      throw new Error('UNIT_REQUIRED')
    }
    const uid = normalizeUnitId(unitId)
    const unitWords = resolveUnitBookWords(bookCode, bookWordsAll, uid)
    const remaining = unitWords.filter(bv => !excludeSet.has(bv.wordId))
    const selected = remaining.slice(0, Math.max(1, count))
    const progressInfo = await getBookProgress(userId, bookCode)
    const now = new Date()

    let unitIds: string[] = []
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { loadCurriculumBook } = require('../../scripts/vocabulary-import/curriculum') as {
        loadCurriculumBook: (code: string) => { units: Array<{ id: string }> }
      }
      unitIds = loadCurriculumBook(bookCode).units.map(u => normalizeUnitId(u.id)).filter(Boolean)
    } catch {
      unitIds = []
    }
    const idx = unitIds.indexOf(uid)
    const nextUnitId = idx >= 0 && idx < unitIds.length - 1 ? unitIds[idx + 1] : null
    return {
      words: selected.map(bv =>
        formatBookWord(bv, { seed: `${userId}:${bv.wordId}:${todayKey(now)}`, rotate: true })
      ),
      progress: progressInfo,
      mode: 'unit' as SessionMode,
      unit: {
        id: uid,
        total: unitWords.length,
        remainingAfter: Math.max(0, remaining.length - selected.length),
        complete: selected.length === 0,
        nextUnitId
      }
    }
  }

  const bookWords = topic
    ? bookWordsAll.filter(bv => bv.word.topic === topic)
    : bookWordsAll
  const wordIds = bookWords.map(bv => bv.wordId)
  const statsMap = await loadUserWordStats(userId, wordIds)
  const aggregated = aggregateBookWordStats(wordIds, statsMap)
  const now = new Date()

  let progress = await prisma.bookStudyProgress.findUnique({
    where: { learnerId_bookId: { learnerId: userId, bookId: book.id } }
  })

  if (!progress) {
    progress = await prisma.bookStudyProgress.create({
      data: { learnerId: userId, bookId: book.id, practicedWordIds: [] }
    })
  }

  const cycleSet = new Set(progress.practicedWordIds)
  const practicedByType = (wordId: string) =>
    practicedForType(statsMap.get(wordId) ?? [], trainingType)
  // 全局已练（同一技能）= 跨书已学过，覆盖/新学时视同本轮已勾选
  const coveredSet = new Set(cycleSet)
  for (const [wordId] of aggregated) {
    if (practicedByType(wordId)) coveredSet.add(wordId)
  }

  // 跨书核对：别的书学过、这本书还没通过确认的词。答对加分，答错降到待复习。
  if (mode === 'recheck') {
    const targetType = trainingType || 'reading'
    const checks = await prisma.bookWordCheck.findMany({
      where: { learnerId: userId, bookId: book.id, type: targetType },
      select: { wordId: true, passed: true, failStreak: true }
    })
    const practicedWords = bookWords.filter(bv =>
      practicedForType(statsMap.get(bv.wordId) ?? [], targetType)
    )
    const { selected, meta } = pickRecheckCandidates(
      practicedWords,
      checks,
      wordId =>
        computeScore(wordId, statsMap, aggregated.get(wordId)!, true, 'weak', targetType),
      count
    )
    const progressInfo = await getBookProgress(userId, bookCode)
    return {
      words: selected.map(bv =>
        formatBookWord(bv, { seed: `${userId}:${bv.wordId}:${todayKey(now)}`, rotate: true })
      ),
      progress: progressInfo,
      mode,
      recheck: meta
    }
  }

  if (mode === 'smart') {
    const dayKey = todayKey(now)
    const candidates: SmartQueueCandidate[] = bookWords.map(bv => {
      const mastery = aggregated.get(bv.wordId)!
      const inCycle = coveredSet.has(bv.wordId)
      const typeStat = getTypeStat(statsMap, bv.wordId, trainingType)
      const fsrs = typeStat ? buildFsrsFieldsFromStat(typeStat, now) : null
      const due = fsrs?.due != null && fsrs.due.getTime() <= now.getTime()
      return {
        id: bv.wordId,
        order: bv.sortOrder,
        score: computeSmartScore(
          userId,
          bv.wordId,
          statsMap,
          mastery,
          practicedByType(bv.wordId),
          inCycle,
          trainingType,
          dayKey
        ),
        isNew: !practicedByType(bv.wordId),
        due,
        weak: due || (fsrs ? getWeakReason(fsrs, now) != null : false),
        recentWrong: typeStat?.recentLapse === true,
        lapses: typeStat?.lapses ?? 0
      }
    })
    const practicedToday = await countPracticedWordsToday(userId, trainingType)
    const dailyNewRemaining = Math.max(0, SMART_DAILY_NEW_CAP - practicedToday)
    const selectedIds = pickSmartQueue(candidates, { count, dailyNewRemaining })
    const byId = new Map(bookWords.map(bv => [bv.wordId, bv]))
    const selected = selectedIds.map(id => byId.get(id)).filter((bv): bv is (typeof bookWords)[number] => !!bv)

    const progressInfo = await getBookProgress(userId, bookCode)
    return {
      words: selected.map(bv => formatBookWord(bv, { seed: `${userId}:${bv.wordId}:${todayKey(now)}`, rotate: true })),
      progress: progressInfo,
      mode
    }
  }

  if (mode === 'review') {
    const practicedBookWords = bookWords.filter(bv => practicedByType(bv.wordId))
    const dueWords = bookWords.filter(bv => {
      const typeStat = getTypeStat(statsMap, bv.wordId, trainingType)
      return typeStat?.due != null && typeStat.due.getTime() <= now.getTime()
    })

    let selectedBookWords = dueWords.slice(0, count)

    if (selectedBookWords.length < count) {
      const dueIds = new Set(selectedBookWords.map(bv => bv.wordId))
      // 整本从未学过时没有可复习的词，退回新学兜底，避免空会话
      const fallbackPool = practicedBookWords.length > 0
        ? practicedBookWords
        : bookWords.filter(bv => !practicedByType(bv.wordId))
      const scored = fallbackPool
        .filter(bv => !dueIds.has(bv.wordId))
        .map(bv => ({
          bv,
          score: computeScore(bv.wordId, statsMap, aggregated.get(bv.wordId)!, coveredSet.has(bv.wordId), 'weak', trainingType)
        }))
        .sort((a, b) => b.score - a.score)
      selectedBookWords = [
        ...selectedBookWords,
        ...scored.slice(0, count - selectedBookWords.length).map(s => s.bv)
      ]
    }

    const progressInfo = await getBookProgress(userId, bookCode)
    return {
      words: selectedBookWords.map(bv => formatBookWord(bv, { seed: `${userId}:${bv.wordId}:${todayKey(now)}`, rotate: true })),
      progress: progressInfo,
      mode
    }
  }

  // weak：先按薄弱度练已学词；没有已学词或数量不足时，才补新词。
  if (mode === 'weak') {
    const scoredWeak = bookWords
      .filter(bv => practicedByType(bv.wordId))
      .map(bv => ({
        bv,
        score: computeScore(bv.wordId, statsMap, aggregated.get(bv.wordId)!, coveredSet.has(bv.wordId), 'weak', trainingType)
      }))
      .sort((a, b) => b.score - a.score)

    let selectedBookWords = scoredWeak.slice(0, count).map(s => s.bv)

    if (selectedBookWords.length < count) {
      const taken = new Set(selectedBookWords.map(bv => bv.wordId))
      const scoredNew = bookWords
        .filter(bv => !practicedByType(bv.wordId) && !taken.has(bv.wordId))
        .map(bv => ({
          bv,
          score: computeScore(
            bv.wordId,
            statsMap,
            aggregated.get(bv.wordId)!,
            coveredSet.has(bv.wordId),
            mode,
            trainingType
          ) + (coveredSet.has(bv.wordId) ? -500 : 800)
        }))
        .sort((a, b) => b.score - a.score)
      selectedBookWords = [
        ...selectedBookWords,
        ...scoredNew.slice(0, count - selectedBookWords.length).map(s => s.bv)
      ]
    }

    const progressInfo = await getBookProgress(userId, bookCode)
    return {
      words: selectedBookWords.map(bv => formatBookWord(bv, { seed: `${userId}:${bv.wordId}:${todayKey(now)}`, rotate: true })),
      progress: progressInfo,
      mode
    }
  }

  // coverage：新学只抽「全局未练」；缺口再用到期复习补，避免 KET 词在 PET 当生词
  const newLearning = bookWords.filter(bv => !practicedByType(bv.wordId))
  const dueReview = bookWords.filter(bv => {
    if (!practicedByType(bv.wordId)) return false
    const typeStat = getTypeStat(statsMap, bv.wordId, trainingType)
    return typeStat?.due != null && typeStat.due.getTime() <= now.getTime()
  })

  const scoredNew = newLearning
    .map(bv => ({
      bv,
      score: computeScore(
        bv.wordId,
        statsMap,
        aggregated.get(bv.wordId)!,
        coveredSet.has(bv.wordId),
        mode,
        trainingType
      ) + (coveredSet.has(bv.wordId) ? -500 : 800)
    }))
    .sort((a, b) => b.score - a.score)

  let selectedBookWords = scoredNew.slice(0, count).map(s => s.bv)

  if (selectedBookWords.length < count && dueReview.length > 0) {
    const taken = new Set(selectedBookWords.map(bv => bv.wordId))
    const scoredDue = dueReview
      .filter(bv => !taken.has(bv.wordId))
      .map(bv => ({
        bv,
        score: computeScore(bv.wordId, statsMap, aggregated.get(bv.wordId)!, true, 'review', trainingType)
      }))
      .sort((a, b) => b.score - a.score)
    selectedBookWords = [
      ...selectedBookWords,
      ...scoredDue.slice(0, count - selectedBookWords.length).map(s => s.bv)
    ]
  }

  // 全书几乎都学过且没有 due：才回落到弱词，避免空场
  if (selectedBookWords.length < count) {
    const taken = new Set(selectedBookWords.map(bv => bv.wordId))
    const scoredRest = bookWords
      .filter(bv => !taken.has(bv.wordId))
      .map(bv => ({
        bv,
        score: computeScore(
          bv.wordId,
          statsMap,
          aggregated.get(bv.wordId)!,
          coveredSet.has(bv.wordId),
          'weak',
          trainingType
        )
      }))
      .sort((a, b) => b.score - a.score)
    selectedBookWords = [
      ...selectedBookWords,
      ...scoredRest.slice(0, count - selectedBookWords.length).map(s => s.bv)
    ]
  }

  const progressInfo = await getBookProgress(userId, bookCode)

  return {
    words: selectedBookWords.map(bv => formatBookWord(bv, { seed: `${userId}:${bv.wordId}:${todayKey(now)}`, rotate: true })),
    progress: progressInfo,
    mode
  }
}

interface AppliedPractice {
  newlyCovered: number
  cycleReset: boolean
}

/** 在事务内合并已练词，并计算本次真正新增的覆盖数。 */
async function applyPracticedWords(
  tx: Prisma.TransactionClient,
  userId: string,
  bookId: string,
  wordIds: string[]
): Promise<AppliedPractice> {
  const uniqueWordIds = [...new Set(wordIds)]
  const progress = await tx.bookStudyProgress.findUnique({
    where: { learnerId_bookId: { learnerId: userId, bookId } }
  })
  const previous = new Set(progress?.practicedWordIds || [])
  const newlyCovered = uniqueWordIds.filter(id => !previous.has(id)).length

  if (!progress) {
    await tx.bookStudyProgress.create({
      data: { learnerId: userId, bookId, practicedWordIds: uniqueWordIds }
    })
    return { newlyCovered, cycleReset: false }
  }

  const bookWordCount = await tx.bookVocabulary.count({ where: { bookId } })
  const merged = [...new Set([...progress.practicedWordIds, ...uniqueWordIds])]

  if (merged.length >= bookWordCount) {
    await tx.bookStudyProgress.update({
      where: { id: progress.id },
      data: {
        practicedWordIds: uniqueWordIds,
        cycleStartedAt: new Date()
      }
    })
    return { newlyCovered, cycleReset: true }
  }

  await tx.bookStudyProgress.update({
    where: { id: progress.id },
    data: { practicedWordIds: merged }
  })
  return { newlyCovered, cycleReset: false }
}

/**
 * 完成一次词汇练习会话：
 * - 已练词合并与当日学习量写入在同一事务内完成，避免并发覆盖；
 * - 当日学习量只累加本次真正新增的词，重复提交同一批词不再重复计数。
 */
export async function completeBookSession(userId: string, bookCode: string, wordIds: string[]) {
  return runSerializable(async tx => {
    const book = await tx.book.findUnique({ where: { code: bookCode }, select: { id: true } })
    if (!book) throw new Error('Book not found')

    const { newlyCovered, cycleReset } = await applyPracticedWords(
      tx,
      userId,
      book.id,
      wordIds
    )

    if (newlyCovered === 0) {
      return { newlyCovered, cycleReset, dailyWordCount: null, streak: null }
    }

    const log = await recordDailyStudyInTx(tx, userId, newlyCovered)
    return {
      newlyCovered,
      cycleReset,
      dailyWordCount: log.wordCount,
      streak: log.streak
    }
  })
}

export { getMasteryStatus }
