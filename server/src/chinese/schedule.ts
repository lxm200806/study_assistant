import {
  DAILY_MINUTES_MAX,
  DEFAULT_DAILY_MINUTES,
  DEFAULT_NEW_ENTRIES_PER_DAY,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  FILTER_BATCH_SIZE,
  KIND_LABEL,
  KINDS,
  LEVELS,
  MASTERY_HIGH,
  PLAN_CALENDAR_DAYS,
  PLAN_WARN_DAYS,
  PLAN_WARN_ENTRY_COUNT,
  isKind,
  type ChineseKind,
  type PointLike
} from './constants'
import {
  energyToMinutes,
  makeSession,
  minutesToEnergy,
  parseDailyMinutes,
  rowsEnergy,
  type StudySession
} from './cards'
import {
  entryIsDue,
  masteryFromCardStates
} from './mastery'
import { normalizeQuestionType } from './entries'

export interface EntryCluster {
  entryKey: string
  lemma: string
  kind: string
  difficulty: string
  level: string
  grade: string
  tags: string
  source: string
  rows: PointLike[]
}

const PROBE_TYPES = [
  'meaning_choice',
  'context_choice',
  'spelling_choice',
  'pinyin_choice',
  'usage_judge',
  'char_judge',
  'recite',
  'dictation'
]

const INTRO_TYPES = ['recite', 'meaning_choice', 'dictation', 'spelling_choice']

export function entryKeyOf(row: PointLike): string {
  return String(row.entry_key || row.entryKey || '').trim() || `id:${row.id ?? row.point_key ?? row.pointKey ?? ''}`
}

export function clusterEntries(rows: PointLike[]): EntryCluster[] {
  const groups = new Map<string, EntryCluster>()
  const order: string[] = []
  for (const row of rows || []) {
    const entryKey = entryKeyOf(row)
    let group = groups.get(entryKey)
    if (!group) {
      group = {
        entryKey,
        lemma: String(row.lemma || row.answer || row.prompt || ''),
        kind: String(row.kind || ''),
        difficulty: String(row.difficulty || ''),
        level: String(row.level || ''),
        grade: String(row.grade || ''),
        tags: String(row.tags || ''),
        source: String(row.source || ''),
        rows: []
      }
      groups.set(entryKey, group)
      order.push(entryKey)
    }
    group.rows.push(row)
    if (!group.lemma && (row.lemma || row.answer)) group.lemma = String(row.lemma || row.answer)
    if (!group.difficulty && row.difficulty) group.difficulty = String(row.difficulty)
  }
  return order.map(key => groups.get(key)!)
}

function difficultyRank(value: string): number {
  const index = (DIFFICULTIES as readonly string[]).indexOf(value)
  return index >= 0 ? index : DIFFICULTIES.length
}

function levelRank(value: string): number {
  const index = (LEVELS as readonly string[]).indexOf(value)
  return index >= 0 ? index : LEVELS.length
}

function frequencyRank(entry: EntryCluster): number {
  const text = `${entry.tags};${entry.source}`
  if (/课内必背|课文/.test(text)) return 0
  if (/日积月累/.test(text)) return 1
  return 2
}

/** 新学排序：基础 → 拓展 → 培优，再课内/高频标签，再级别，再词条名。 */
export function compareLearningEntries(a: EntryCluster, b: EntryCluster): number {
  return (
    difficultyRank(a.difficulty) - difficultyRank(b.difficulty) ||
    frequencyRank(a) - frequencyRank(b) ||
    levelRank(a.level) - levelRank(b.level) ||
    String(a.lemma || '').localeCompare(String(b.lemma || ''), 'zh') ||
    a.entryKey.localeCompare(b.entryKey, 'zh')
  )
}

export function sortLearningEntries(entries: EntryCluster[]): EntryCluster[] {
  return [...entries].sort(compareLearningEntries)
}

export function targetNewEntriesPerDay(dailyMinutes: unknown = DEFAULT_DAILY_MINUTES): number {
  const minutes = parseDailyMinutes(dailyMinutes)
  return Math.min(12, Math.max(3, Math.round((DEFAULT_NEW_ENTRIES_PER_DAY * minutes) / DEFAULT_DAILY_MINUTES)))
}

export function courseFingerprint(
  kinds: string[],
  levels: string[],
  grades: string[],
  difficulties: string[],
  dailyMinutes: number
) {
  return {
    kinds: [...kinds].sort().join(','),
    levels: [...levels].sort().join(','),
    grades: [...grades].sort().join(','),
    difficulties: [...difficulties].sort().join(','),
    dailyMinutes
  }
}

export function suggestCourseCopy(input: {
  kinds?: string[]
  grades?: string[]
  difficulties?: string[]
  dailyMinutes?: number
}) {
  const kinds = (input.kinds || []).filter(item => isKind(item)) as ChineseKind[]
  const kindText = (kinds.length ? kinds : [...KINDS]).map(id => KIND_LABEL[id]).join('/')
  const diffs = (input.difficulties || []).filter(item => (DIFFICULTIES as readonly string[]).includes(item))
  const diffText =
    diffs.length && diffs.length < DIFFICULTIES.length
      ? diffs.map(id => DIFFICULTY_LABEL[id as keyof typeof DIFFICULTY_LABEL]).join('/')
      : ''
  const grades = input.grades || []
  const gradeText = grades.length === 1 ? grades[0] : grades.length ? `${grades[0]}等${grades.length}册` : ''
  const minutes = parseDailyMinutes(input.dailyMinutes)
  const idiomOnly = kinds.length === 1 && kinds[0] === 'idiom'
  const name = idiomOnly
    ? `小学成语${diffText ? ` · ${diffText}` : ''} · 每天${minutes}分钟`
    : [gradeText, kindText || '语文'].filter(Boolean).join(' · ')
  const note = idiomOnly
    ? `按词条学习，每天约 ${targetNewEntriesPerDay(minutes)} 个新成语；先基础后拓展。`
    : `每天约 ${minutes} 分钟，按词条安排新学与复习。`
  return { name, note }
}

function typeRank(row: PointLike, preferred: string[]): number {
  const qtype = normalizeQuestionType(row.question_type || row.questionType)
  const index = preferred.indexOf(qtype)
  return index >= 0 ? index : preferred.length
}

export function pickEntryCards(rows: PointLike[], preferred: string[], maxCards: number): PointLike[] {
  const ranked = [...rows].sort((a, b) => typeRank(a, preferred) - typeRank(b, preferred))
  const picked: PointLike[] = []
  const seen = new Set<string>()
  for (const row of ranked) {
    const qtype = normalizeQuestionType(row.question_type || row.questionType)
    if (seen.has(qtype)) continue
    seen.add(qtype)
    picked.push(row)
    if (picked.length >= maxCards) break
  }
  return picked.length ? picked : rows.slice(0, Math.max(1, maxCards))
}

export function probeCard(rows: PointLike[]): PointLike {
  return pickEntryCards(rows, PROBE_TYPES, 1)[0] || rows[0]
}

function sessionFor(entry: EntryCluster, cards: PointLike[], role: 'new' | 'review'): StudySession {
  const session = makeSession({ group_key: entry.entryKey, rows: cards }, cards)
  session.role = role
  session.title = entry.lemma || session.title
  return session
}

function packEntries(
  entries: EntryCluster[],
  role: 'new' | 'review',
  maxCount: number,
  maxEnergy: number,
  picker: (entry: EntryCluster) => PointLike[]
): { sessions: StudySession[]; energy: number } {
  const sessions: StudySession[] = []
  let energy = 0
  if (maxCount <= 0 || maxEnergy <= 0) return { sessions, energy }
  for (const entry of entries) {
    const cards = picker(entry).filter(Boolean)
    if (!cards.length) continue
    const cost = rowsEnergy(cards)
    if (sessions.length && (sessions.length >= maxCount || energy + cost > maxEnergy)) break
    sessions.push(sessionFor(entry, cards, role))
    energy += cost
  }
  return { sessions, energy }
}

export function courseSizeWarning(input: {
  estimatedDays: number
  calendarDays: number
  dailyMinutes: number
  pointCount: number
  entryCount: number
  newPerDay: number
  truncated: boolean
}) {
  const oversized =
    input.estimatedDays > PLAN_WARN_DAYS ||
    input.entryCount > PLAN_WARN_ENTRY_COUNT
  if (!oversized) return ''
  const head = input.estimatedDays > PLAN_CALENDAR_DAYS
    ? `按每天约 ${input.newPerDay} 个新词条估算约需 ${input.estimatedDays} 天。`
    : `课程规模较大，按每天约 ${input.newPerDay} 个新词条预计约 ${input.estimatedDays} 天。`
  return `${head}建议按难度分层组课，或缩小年级/类型范围后再生成。`
}

function serializeEntryDays(
  days: Array<{ day: number; newEntries: EntryCluster[]; reviewEntries: EntryCluster[]; minutes: number }>
) {
  return days.map(day => {
    const cards = [
      ...day.newEntries.map(entry => ({
        title: entry.lemma,
        knowledgePoint: entry.lemma,
        summary: entry.source,
        groupKey: entry.entryKey,
        kind: entry.kind,
        grade: entry.grade,
        source: entry.source,
        energy: rowsEnergy(entry.rows),
        estimatedMinutes: energyToMinutes(rowsEnergy(pickEntryCards(entry.rows, INTRO_TYPES, 2))),
        pointCount: entry.rows.length,
        questionCount: entry.rows.length,
        part: 1,
        parts: 1,
        role: 'new',
        prompts: [],
        entries: []
      })),
      ...day.reviewEntries.map(entry => ({
        title: entry.lemma,
        knowledgePoint: entry.lemma,
        summary: entry.source,
        groupKey: entry.entryKey,
        kind: entry.kind,
        grade: entry.grade,
        source: entry.source,
        energy: rowsEnergy(entry.rows),
        estimatedMinutes: energyToMinutes(rowsEnergy(pickEntryCards(entry.rows, PROBE_TYPES, 2))),
        pointCount: entry.rows.length,
        questionCount: Math.min(2, entry.rows.length),
        part: 1,
        parts: 1,
        role: 'review',
        prompts: [],
        entries: []
      }))
    ]
    const newEnergy = day.newEntries.reduce((sum, entry) => sum + rowsEnergy(pickEntryCards(entry.rows, INTRO_TYPES, 2)), 0)
    const reviewEnergy = day.reviewEntries.reduce((sum, entry) => sum + rowsEnergy(pickEntryCards(entry.rows, PROBE_TYPES, 2)), 0)
    return {
      day: day.day,
      mode: reviewEnergy && newEnergy ? 'mixed' : reviewEnergy ? 'review' : 'new',
      energy: newEnergy + reviewEnergy,
      estimatedMinutes: day.minutes,
      newEnergy,
      reviewEnergy,
      pointCount: cards.reduce((sum, item) => sum + item.pointCount, 0),
      newPointCount: day.newEntries.reduce((sum, entry) => sum + entry.rows.length, 0),
      reviewPointCount: day.reviewEntries.reduce((sum, entry) => sum + entry.rows.length, 0),
      cardCount: cards.length,
      cards
    }
  })
}

export function planCourseDays(rows: PointLike[], dailyMinutes: unknown = DEFAULT_DAILY_MINUTES) {
  const minutes = parseDailyMinutes(dailyMinutes)
  const dailyBudget = minutesToEnergy(minutes)
  const entries = sortLearningEntries(clusterEntries(rows))
  const newPerDay = targetNewEntriesPerDay(minutes)
  const introDays = entries.length ? Math.ceil(entries.length / newPerDay) : 0
  const estimatedDays = introDays
  const calendarDays = Math.min(PLAN_CALENDAR_DAYS, introDays)
  const truncated = estimatedDays > calendarDays
  const days: Array<{ day: number; newEntries: EntryCluster[]; reviewEntries: EntryCluster[]; minutes: number }> = []
  const reviewOffsets = [1, 3, 7, 15]
  for (let day = 1; day <= calendarDays; day++) {
    const newEntries = entries.slice((day - 1) * newPerDay, day * newPerDay)
    const reviewKeys = new Set<string>()
    for (const offset of reviewOffsets) {
      const sourceDay = day - offset
      if (sourceDay < 1) continue
      for (const entry of entries.slice((sourceDay - 1) * newPerDay, sourceDay * newPerDay)) {
        if (newEntries.some(item => item.entryKey === entry.entryKey)) continue
        reviewKeys.add(entry.entryKey)
      }
    }
    const reviewEntries = entries.filter(entry => reviewKeys.has(entry.entryKey)).slice(0, newPerDay * 2)
    days.push({ day, newEntries, reviewEntries, minutes })
  }
  const warning = courseSizeWarning({
    estimatedDays,
    calendarDays,
    dailyMinutes: minutes,
    pointCount: rows.length,
    entryCount: entries.length,
    newPerDay,
    truncated
  })
  const copy = suggestCourseCopy({
    kinds: [...new Set(entries.map(item => item.kind))],
    difficulties: [...new Set(entries.map(item => item.difficulty).filter(Boolean))],
    dailyMinutes: minutes
  })
  return {
    dailyMinutes: minutes,
    dailyEnergy: dailyBudget,
    newEnergy: dailyBudget,
    reviewEnergy: dailyBudget,
    groupCount: entries.length,
    entryCount: entries.length,
    pointCount: rows.length,
    totalEnergy: rowsEnergy(rows),
    newPerDay,
    dayCount: calendarDays,
    newDayCount: calendarDays,
    calendarDays,
    estimatedDays,
    rawDayCount: estimatedDays,
    truncated,
    warning,
    suggestedName: copy.name,
    suggestedNote: copy.note,
    sortKey: 'difficulty, in-text/high-freq tags, level, lemma',
    days: serializeEntryDays(days)
  }
}

export function planTodayGroups(
  rows: PointLike[],
  failedIds: Set<unknown>,
  today: string,
  dailyMinutes: unknown = DEFAULT_DAILY_MINUTES,
  spentEnergy: unknown = 0,
  extraMinutes: unknown = 0,
  mode = 'learn'
) {
  const baseMinutes = parseDailyMinutes(dailyMinutes)
  const extensionMinutes = Math.max(0, Math.min(Number(extraMinutes) || 0, DAILY_MINUTES_MAX))
  const targetMinutes = baseMinutes + extensionMinutes
  const dailyBudget = minutesToEnergy(targetMinutes)
  const spent = Math.max(0, Number(spentEnergy) || 0)
  const available = Math.max(0, dailyBudget - spent)
  const newPerDay = targetNewEntriesPerDay(baseMinutes)
  const entries = sortLearningEntries(clusterEntries(rows))
  const failed = entries.filter(entry => entry.rows.some(row => failedIds.has(row.id)))
  const unseen = entries.filter(entry => entry.rows.every(row => !row.last))
  const learning = entries.filter(entry => !unseen.includes(entry))
  const due = learning.filter(entry => entryIsDue(entry.rows, today))

  if (mode === 'filter') {
    const candidates = unseen.concat(learning.filter(entry => masteryFromCardStates(entry.rows, today) < MASTERY_HIGH))
    const packed = packEntries(candidates, 'new', FILTER_BATCH_SIZE, Math.max(available, dailyBudget), entry => [probeCard(entry.rows)])
    return wrapToday(packed.sessions, packed.energy, 0, {
      due: due.length,
      failed: failed.length,
      fresh: unseen.length,
      baseMinutes,
      targetMinutes,
      extensionMinutes,
      spent,
      available
    })
  }

  const reviewPool = [...failed, ...due.filter(entry => !failed.includes(entry))]
  const reviewCap = Math.max(newPerDay, Math.ceil(newPerDay * 1.5))
  const reviews = packEntries(
    reviewPool,
    'review',
    reviewCap,
    Math.max(8, Math.floor(available * 0.55) || available),
    entry => {
      const unseenCards = entry.rows.filter(row => !row.last)
      if (unseenCards.length) return pickEntryCards(unseenCards, PROBE_TYPES, 2)
      return pickEntryCards(entry.rows, PROBE_TYPES, 2)
    }
  )
  const remainingEnergy = Math.max(0, available - reviews.energy)
  const usedKeys = new Set(reviews.sessions.map(item => item.group_key))
  const freshPool = unseen.filter(entry => !usedKeys.has(entry.entryKey))
  const news = packEntries(
    freshPool,
    'new',
    newPerDay,
    remainingEnergy || available,
    entry => pickEntryCards(entry.rows, INTRO_TYPES, entry.kind === 'idiom' ? 2 : 1)
  )
  return wrapToday([...reviews.sessions, ...news.sessions], news.energy, reviews.energy, {
    due: due.length,
    failed: failed.length,
    fresh: unseen.length,
    baseMinutes,
    targetMinutes,
    extensionMinutes,
    spent,
    available
  })
}

function wrapToday(
  groups: StudySession[],
  newEnergy: number,
  reviewEnergy: number,
  meta: {
    due: number
    failed: number
    fresh: number
    baseMinutes: number
    targetMinutes: number
    extensionMinutes: number
    spent: number
    available: number
  }
) {
  return {
    groups,
    due: meta.due,
    failed: meta.failed,
    fresh: meta.fresh,
    tasks: groups.length,
    cards: groups.reduce((sum, session) => sum + session.rows.length, 0),
    newEnergy,
    reviewEnergy,
    newBudget: minutesToEnergy(meta.targetMinutes),
    reviewBudget: minutesToEnergy(meta.targetMinutes),
    dailyMinutes: meta.baseMinutes,
    targetMinutes: meta.targetMinutes,
    extraMinutes: meta.extensionMinutes,
    spentMinutes: energyToMinutes(meta.spent),
    remainingMinutes: Math.min(
      Math.max(0, meta.targetMinutes - energyToMinutes(meta.spent)),
      energyToMinutes(reviewEnergy + newEnergy)
    )
  }
}
