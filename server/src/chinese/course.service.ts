import prisma from '../prisma/client'
import {
  clusterGroups,
  decodeFilters,
  energyToMinutes,
  encodeFilters,
  fillGroupFields,
  flattenTodayGroups,
  GRADES,
  KINDS,
  LEVELS,
  makeSession,
  normalizeGrade,
  pageArgs,
  parseDailyMinutes,
  parseEnergyLimit,
  parseResourceFilter,
  planCourseDays,
  planTodayGroups,
  pointEnergy,
  minutesToEnergy,
  validateCard
} from './cards'
import {
  AUDIENCE_LABEL,
  DEFAULT_COURSE_NAME,
  DEFAULT_DAILY_MINUTES,
  DEFAULT_NEW_ENERGY,
  DEFAULT_REVIEW_ENERGY,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  KIND_LABEL,
  QUESTION_TYPE_LABEL,
  isKind,
  isLevel,
  normalizeAudience,
  normalizeDifficulty,
  normalizeQuestionType,
  type PointLike
} from './constants'
import { audiencesForGrades, pickCourseCards, parseOptions } from './entries'
import { HttpError } from './http'
import { decorateResource, findPack, packStatus, PACKS, upsertEntry } from './materials'
import { buildProgress, kidFeedback, masteryCounts, parentCopy } from './progress'
import * as sm2 from './sm2'
import { MODE_OPTIONS, answerLines, applyTodayMode, isRecitable, normalizeMode, resolveDefaultMode, reviewOutcome } from './study-modes'
import { gradeCard } from './grade'

function asDay(value: Date | string | null | undefined): string {
  if (!value) return ''
  return sm2.formatDay(value)
}

function toPointLike(row: {
  id: string
  kind: string
  level: string
  grade: string
  prompt: string
  answer: string
  tags: string
  source: string
  pointKey?: string | null
  groupKey?: string
  subGroupKey?: string
  entryKey?: string
  lemma?: string
  questionType?: string
  audience?: string
  difficulty?: string
  isActive?: boolean
  options?: string
  n?: number | null
  ef?: number | null
  interval?: number | null
  due?: Date | string | null
  lapses?: number | null
  last?: Date | string | null
}): PointLike {
  return {
    id: row.id,
    kind: row.kind,
    level: row.level,
    grade: row.grade,
    prompt: row.prompt,
    answer: row.answer,
    tags: row.tags,
    source: row.source,
    point_key: row.pointKey || '',
    group_key: row.groupKey || '',
    sub_group_key: row.subGroupKey || '',
    entry_key: row.entryKey || '',
    lemma: row.lemma || '',
    question_type: row.questionType || 'dictation',
    audience: row.audience || 'all',
    difficulty: row.difficulty || '',
    active: row.isActive !== false,
    options: row.options || '',
    n: row.n,
    ef: row.ef,
    interval: row.interval,
    due: asDay(row.due),
    lapses: row.lapses,
    last: asDay(row.last) || null
  }
}

export function metaPayload() {
  return {
    kinds: KINDS.map(id => ({ id, label: KIND_LABEL[id] })),
    levels: [...LEVELS],
    grades: [...GRADES],
    questionTypes: Object.entries(QUESTION_TYPE_LABEL).map(([id, label]) => ({ id, label })),
    audiences: Object.entries(AUDIENCE_LABEL).map(([id, label]) => ({ id, label })),
    difficulties: Object.entries(DIFFICULTY_LABEL).map(([id, label]) => ({ id, label })),
    studyModes: [...MODE_OPTIONS]
  }
}

function decorateLibraryItem(row: PointLike & { resource_slug?: string; resource_filename?: string; entry_grades?: string; entry_levels?: string }, hideAnswer = false) {
  const spec = findPack(row.resource_slug || '')
  const data: Record<string, unknown> = {
    ...row,
    resourceTitle: spec?.title || row.resource_filename || '',
    sourceResourceId: row.source_resource_id,
    pointKey: row.point_key || '',
    groupKey: row.group_key || '',
    subGroupKey: row.sub_group_key || '',
    entryKey: row.entry_key || '',
    lemma: row.lemma || '',
    questionType: row.question_type || 'dictation',
    audience: row.audience || 'all',
    difficulty: row.difficulty || '',
    options: parseOptions(row.options),
    energy: pointEnergy(row),
    entryGrades: row.entry_grades || '',
    entryLevels: row.entry_levels || ''
  }
  if (hideAnswer) delete data.answer
  return data
}

function courseFilters(course: { kinds: string; levels: string; grades: string; difficulties: string }) {
  const kinds = decodeFilters(course.kinds, KINDS)
  const levels = decodeFilters(course.levels, LEVELS)
  const grades = decodeFilters(course.grades, GRADES)
  const difficulties = decodeFilters(course.difficulties, DIFFICULTIES)
  return {
    kinds: kinds.length ? kinds : [...KINDS],
    levels: levels.length ? levels : [...LEVELS],
    grades,
    difficulties: difficulties.length ? difficulties : [...DIFFICULTIES]
  }
}

function isDefaultCourse(course: { name: string }) {
  return course.name === DEFAULT_COURSE_NAME
}

export function serializeCourse(
  row: {
    id: string
    name: string
    note: string
    kinds: string
    levels: string
    grades: string
    difficulties: string
    newEnergy: number
    reviewEnergy: number
    dailyMinutes: number
    reviewDefaultTest: boolean
    createdAt?: Date
  },
  itemCount?: number,
  plan?: unknown,
  publishedCount?: number,
  progress?: unknown
) {
  const data: Record<string, unknown> = {
    ...row,
    kinds: decodeFilters(row.kinds, KINDS),
    levels: decodeFilters(row.levels, LEVELS),
    grades: decodeFilters(row.grades, GRADES),
    difficulties: decodeFilters(row.difficulties, DIFFICULTIES),
    newEnergy: row.newEnergy || 30,
    reviewEnergy: row.reviewEnergy || 30,
    dailyMinutes: parseDailyMinutes(row.dailyMinutes),
    reviewDefaultTest: Boolean(row.reviewDefaultTest),
    isDefault: isDefaultCourse(row)
  }
  if (itemCount != null) {
    data.itemCount = itemCount
    data.item_count = itemCount
  }
  if (publishedCount != null) {
    data.publishedCount = publishedCount
    data.pendingCount = Math.max(0, publishedCount - Number(data.itemCount || 0))
  }
  if (plan != null) data.plan = plan
  if (progress != null) data.progress = progress
  return data
}

function serializePoint(point: PointLike, extra?: Record<string, unknown>) {
  const data: Record<string, unknown> = {
    id: point.id,
    kind: point.kind,
    level: point.level,
    grade: point.grade || '',
    prompt: point.prompt,
    tags: point.tags,
    source: point.source,
    fresh: !point.last,
    due: point.due || null,
    pointKey: point.point_key || '',
    groupKey: point.group_key || '',
    subGroupKey: point.sub_group_key || '',
    entryKey: point.entry_key || '',
    lemma: point.lemma || '',
    questionType: point.question_type || 'dictation',
    audience: point.audience || 'all',
    difficulty: point.difficulty || '',
    active: point.active !== false,
    energy: pointEnergy(point)
  }
  if (extra) Object.assign(data, extra)
  return data
}

async function pendingDraftMatcher() {
  const drafts = await prisma.chineseDraft.findMany({
    where: { status: 'draft' },
    select: { pointKey: true, prompt: true, answer: true }
  })
  const keys = new Set(drafts.map(item => String(item.pointKey || '').trim()).filter(Boolean))
  const pairs = new Set(drafts.map(item => `${item.prompt}\0${item.answer}`))
  return (row: { pointKey?: string | null; point_key?: string; prompt: string; answer: string }) => {
    const key = String(row.pointKey || row.point_key || '').trim()
    if (key && keys.has(key)) return true
    return pairs.has(`${row.prompt}\0${row.answer}`)
  }
}

async function withoutPendingDrafts<T extends { pointKey?: string | null; point_key?: string; prompt: string; answer: string }>(rows: T[]) {
  if (!rows.length) return rows
  const isShadow = await pendingDraftMatcher()
  return rows.filter(row => !isShadow(row))
}

async function candidatePoints(kinds: string[], levels: string[], grades: string[], difficulties: string[] = [...DIFFICULTIES]) {
  const wanted = audiencesForGrades(grades)
  const rows = await withoutPendingDrafts(
    await prisma.chinesePublished.findMany({
      where: {
        isActive: true,
        kind: { in: kinds },
        level: { in: levels },
        OR: [
          { kind: { not: 'idiom' } },
          { difficulty: { in: difficulties.length ? difficulties : [...DIFFICULTIES] } }
        ],
        ...(wanted ? { audience: { in: Array.from(wanted) } } : {})
      },
      orderBy: [{ grade: 'asc' }, { kind: 'asc' }, { entryKey: 'asc' }, { questionType: 'asc' }, { id: 'asc' }]
    })
  )
  let filtered = rows
  if (grades.length) {
    const gradeLinks = await prisma.chineseEntryGrade.findMany({
      where: { grade: { in: grades } },
      select: { entryKey: true }
    })
    const allowedKeys = new Set(gradeLinks.map(item => item.entryKey))
    filtered = rows.filter(row => grades.includes(row.grade) || (row.entryKey && allowedKeys.has(row.entryKey)))
  }
  return pickCourseCards(filtered.map(toPointLike), grades)
}

export async function ensureUserDefaultCourse(userId: string) {
  const existing = await prisma.chineseCourse.count({ where: { userId } })
  if (existing) return null
  const points = await candidatePoints([...KINDS], [...LEVELS], [], [...DIFFICULTIES])
  if (!points.length) return null
  const course = await prisma.chineseCourse.create({
    data: {
      userId,
      name: DEFAULT_COURSE_NAME,
      note: '系统预置，含已发布知识点',
      kinds: encodeFilters([...KINDS], KINDS),
      levels: encodeFilters([...LEVELS], LEVELS),
      grades: '',
      difficulties: encodeFilters([...DIFFICULTIES], DIFFICULTIES),
      dailyMinutes: DEFAULT_DAILY_MINUTES
    }
  })
  if (points.length) {
    await prisma.chineseCourseItem.createMany({
      data: points.map((point, index) => ({ courseId: course.id, pointId: String(point.id), sort: index }))
    })
  }
  return course
}

async function matchingPublishedCount(course: { kinds: string; levels: string; grades: string; difficulties: string }) {
  const { kinds, levels, grades, difficulties } = courseFilters(course)
  return (await candidatePoints(kinds, levels, grades, difficulties)).length
}

async function courseItemCount(courseId: string) {
  return prisma.chineseCourseItem.count({ where: { courseId } })
}

async function courseEntryCount(courseId: string) {
  const rows = await prisma.chineseCourseItem.findMany({
    where: { courseId },
    select: { pointId: true, point: { select: { entryKey: true } } }
  })
  return new Set(rows.map(row => row.point.entryKey || `id:${row.pointId}`)).size
}

async function pruneDuplicateCourseItems(courseId: string, points: PointLike[]) {
  const canonical = new Map<string, string>()
  for (const point of points) {
    const key = `${String(point.entry_key || '') || `id:${point.id}`}|${normalizeQuestionType(point.question_type)}`
    canonical.set(key, String(point.id))
  }
  if (!canonical.size) return 0
  const extras = await prisma.chineseCourseItem.findMany({
    where: { courseId },
    include: { point: true }
  })
  let removed = 0
  for (const row of extras) {
    const key = `${row.point.entryKey || `id:${row.pointId}`}|${normalizeQuestionType(row.point.questionType)}`
    const keepId = canonical.get(key)
    if (keepId && row.pointId !== keepId) {
      await prisma.chineseCourseItem.delete({ where: { courseId_pointId: { courseId, pointId: row.pointId } } })
      removed += 1
    }
  }
  return removed
}

async function syncCourseItems(course: { id: string; kinds: string; levels: string; grades: string; difficulties: string; name: string }) {
  const { kinds, levels, grades, difficulties } = courseFilters(course)
  if ((!decodeFilters(course.kinds, KINDS).length || !decodeFilters(course.levels, LEVELS).length) && !isDefaultCourse(course)) {
    return 0
  }
  const existing = await prisma.chineseCourseItem.findMany({ where: { courseId: course.id } })
  const have = new Set(existing.map(item => item.pointId))
  let maxSort = existing.reduce((max, item) => Math.max(max, item.sort), -1)
  let added = 0
  const points = await candidatePoints(kinds, levels, grades, difficulties)
  for (const point of points) {
    if (have.has(String(point.id))) continue
    maxSort += 1
    await prisma.chineseCourseItem.create({
      data: { courseId: course.id, pointId: String(point.id), sort: maxSort }
    })
    added += 1
  }
  const removed = await pruneDuplicateCourseItems(course.id, points)
  return added + removed
}

async function ownCourse(courseId: string, userId: string) {
  const course = await prisma.chineseCourse.findFirst({ where: { id: courseId, userId } })
  if (!course) throw new HttpError(404, '课程不存在')
  return course
}

async function loadTodayPoints(courseId: string, userId: string) {
  const items = await prisma.chineseCourseItem.findMany({
    where: { courseId },
    include: { point: true },
    orderBy: [{ sort: 'asc' }]
  })
  const states = await prisma.chineseReviewState.findMany({ where: { courseId, userId } })
  const stateMap = new Map(states.map(item => [item.pointId, item]))
  return items.map(item => {
    const state = stateMap.get(item.pointId)
    return toPointLike({
      ...item.point,
      n: state?.n,
      ef: state?.ef,
      interval: state?.interval,
      due: state?.due,
      lapses: state?.lapses,
      last: state?.last
    })
  })
}

async function loadTodayLogs(courseId: string, userId: string, today: string) {
  const start = new Date(`${today}T00:00:00`)
  const end = new Date(`${today}T23:59:59.999`)
  const logs = await prisma.chineseReviewLog.findMany({
    where: { courseId, userId, createdAt: { gte: start, lte: end } },
    include: {
      point: {
        select: {
          kind: true,
          questionType: true,
          tags: true,
          lemma: true,
          answer: true
        }
      }
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
  })
  return logs.map(log => ({
    point_id: log.pointId,
    quality: log.quality,
    correct: log.correct,
    is_new: log.isNew,
    created_at: log.createdAt,
    kind: log.point.kind,
    energy: pointEnergy({
      kind: log.point.kind,
      question_type: log.point.questionType,
      tags: log.point.tags,
      lemma: log.point.lemma,
      answer: log.point.answer
    })
  }))
}

function failedIdsFromLogs(logs: Array<{ point_id: string; quality: number }>) {
  const latest = new Map<string, number>()
  for (const row of logs) latest.set(row.point_id, Number(row.quality || 0))
  return new Set([...latest.entries()].filter(([, quality]) => quality < 3).map(([id]) => id))
}

async function planCourseToday(
  course: { id: string; dailyMinutes: number; newEnergy: number; reviewEnergy: number },
  userId: string,
  today: string,
  extraMinutes = 0
) {
  const points = await loadTodayPoints(course.id, userId)
  const logs = await loadTodayLogs(course.id, userId, today)
  const spentEnergy = logs.reduce((sum, log) => sum + Number(log.energy || 0), 0)
  const planned = planTodayGroups(
    points,
    failedIdsFromLogs(logs),
    today,
    course.dailyMinutes || DEFAULT_DAILY_MINUTES,
    spentEnergy,
    extraMinutes
  )
  return { points, logs, planned }
}

async function ensureDefaultSynced(course: {
  id: string
  name: string
  note: string
  kinds: string
  levels: string
  grades: string
  difficulties: string
  newEnergy: number
  reviewEnergy: number
  dailyMinutes: number
  reviewDefaultTest: boolean
}) {
  if (!isDefaultCourse(course)) return course
  const itemCount = await prisma.chineseCourseItem.count({ where: { courseId: course.id } })
  if (itemCount > 0) return course
  await syncCourseItems(course)
  return course
}

export async function listLibrary(query: Record<string, unknown>, isAdmin: boolean) {
  const kinds = query.kinds ? decodeFilters(String(query.kinds), KINDS) : query.kind && isKind(String(query.kind)) ? [String(query.kind)] : []
  const levels = query.levels ? decodeFilters(String(query.levels), LEVELS) : query.level && isLevel(String(query.level)) ? [String(query.level)] : []
  const useEntryGrades = Boolean(query.grades)
  const grades = useEntryGrades
    ? decodeFilters(String(query.grades), GRADES)
    : query.grade && (GRADES as readonly string[]).includes(String(query.grade))
      ? [String(query.grade)]
      : []
  const hideAnswer = !isAdmin && !query.answers
  const [limit, offset] = pageArgs(query.limit, query.offset)
  const where: any = {}
  if (!(isAdmin && query.includeInactive)) where.isActive = true
  if (kinds.length) where.kind = { in: kinds }
  if (levels.length) where.level = { in: levels }
  const qtype = query.questionType ? normalizeQuestionType(query.questionType) : ''
  if (query.questionType && qtype) where.questionType = qtype
  const aud = query.audience ? normalizeAudience(query.audience) : ''
  if (query.audience && aud) where.audience = aud
  const difficultyList = query.difficulties
    ? decodeFilters(String(query.difficulties), DIFFICULTIES)
    : query.difficulty
      ? [normalizeDifficulty(query.difficulty)].filter(Boolean)
      : []
  if (difficultyList.length) {
    where.OR = [{ kind: { not: 'idiom' } }, { difficulty: { in: difficultyList } }]
  }
  const resourceFilter = parseResourceFilter(query.resourceId, Boolean(query.unlinked))
  if (resourceFilter === 0) where.sourceResourceId = null
  else if (resourceFilter) where.sourceResourceId = String(resourceFilter)

  const rows = await withoutPendingDrafts(
    await prisma.chinesePublished.findMany({
      where,
      include: { sourceResource: true },
      orderBy: [{ grade: 'asc' }, { kind: 'asc' }, { entryKey: 'asc' }, { questionType: 'asc' }, { id: 'asc' }]
    })
  )
  const entries = await prisma.chineseEntry.findMany({
    where: { entryKey: { in: Array.from(new Set(rows.map(row => row.entryKey).filter(Boolean))) } }
  })
  const entryMap = new Map(entries.map(item => [item.entryKey, item]))
  let mapped = rows.map(row => {
    const entry = entryMap.get(row.entryKey)
    return {
      ...toPointLike(row),
      source_resource_id: row.sourceResourceId,
      resource_filename: row.sourceResource?.filename,
      resource_slug: row.sourceResource?.slug,
      entry_grades: entry?.grades || '',
      entry_levels: entry?.levels || ''
    }
  })
  if (useEntryGrades && grades.length) {
    const wanted = audiencesForGrades(grades)
    if (wanted) mapped = mapped.filter(row => wanted.has(String(row.audience || 'all')))
    const gradeLinks = await prisma.chineseEntryGrade.findMany({ where: { grade: { in: grades } } })
    const allowedKeys = new Set(gradeLinks.map(item => item.entryKey))
    mapped = mapped.filter(row => grades.includes(String(row.grade || '')) || (row.entry_key && allowedKeys.has(String(row.entry_key))))
    mapped = pickCourseCards(mapped, grades) as typeof mapped
  } else if (grades.length) {
    mapped = mapped.filter(row => grades.includes(String(row.grade || '')))
  }
  const total = mapped.length
  const entryCount = new Set(mapped.map(row => String(row.entry_key || '') || `id:${row.id}`)).size
  const page = mapped.slice(offset, offset + limit)
  return {
    items: page.map(row => decorateLibraryItem(row, hideAnswer)),
    total,
    entryCount,
    limit,
    offset
  }
}

export async function createCourse(userId: string, body: { name?: string; note?: string; kinds?: string[]; levels?: string[]; grades?: string[]; difficulties?: string[]; dailyMinutes?: number; newEnergy?: number; reviewEnergy?: number; reviewDefaultTest?: boolean }) {
  const name = String(body.name || '').trim()
  if (!name) throw new HttpError(400, '请填写课程名称')
  const kinds = (body.kinds || []).filter(item => isKind(item))
  const levels = (body.levels || []).filter(item => isLevel(item))
  const grades = (body.grades || []).filter(item => (GRADES as readonly string[]).includes(item))
  const difficulties = (body.difficulties || []).filter(item => (DIFFICULTIES as readonly string[]).includes(item))
  const useKinds = kinds.length ? kinds : [...KINDS]
  const useLevels = levels.length ? levels : [...LEVELS]
  const useDifficulties = difficulties.length ? difficulties : [...DIFFICULTIES]
  const legacyMinutes = body.dailyMinutes == null && (body.newEnergy != null || body.reviewEnergy != null)
    ? Math.round((Number(body.newEnergy || 0) + Number(body.reviewEnergy || 0)) / 4)
    : body.dailyMinutes
  const dailyMinutes = parseDailyMinutes(legacyMinutes)
  const legacyHalfBudget = Math.max(8, Math.round(minutesToEnergy(dailyMinutes) / 2))
  const newEnergy = body.newEnergy == null ? legacyHalfBudget : parseEnergyLimit(body.newEnergy) || legacyHalfBudget
  const reviewEnergy = body.reviewEnergy == null ? legacyHalfBudget : parseEnergyLimit(body.reviewEnergy) || legacyHalfBudget
  const points = await candidatePoints(useKinds, useLevels, grades, useDifficulties)
  if (!points.length) throw new HttpError(400, '没有符合条件的已发布知识点')
  const course = await prisma.chineseCourse.create({
    data: {
      userId,
      name,
      note: String(body.note || '').trim(),
      kinds: encodeFilters(useKinds, KINDS),
      levels: encodeFilters(useLevels, LEVELS),
      grades: encodeFilters(grades, GRADES),
      difficulties: encodeFilters(useDifficulties, DIFFICULTIES),
      newEnergy,
      reviewEnergy,
      dailyMinutes,
      reviewDefaultTest: Boolean(body.reviewDefaultTest)
    }
  })
  await prisma.chineseCourseItem.createMany({
    data: points.map((point, index) => ({ courseId: course.id, pointId: String(point.id), sort: index }))
  })
  const plan = planCourseDays(points, dailyMinutes)
  return { ...serializeCourse(course, points.length, plan, points.length), entryCount: plan.groupCount }
}

export async function previewCourse(body: { kinds?: string[]; levels?: string[]; grades?: string[]; difficulties?: string[]; dailyMinutes?: number; newEnergy?: number; reviewEnergy?: number }) {
  const kinds = (body.kinds || []).filter(item => isKind(item))
  const levels = (body.levels || []).filter(item => isLevel(item))
  const grades = (body.grades || []).filter(item => (GRADES as readonly string[]).includes(item))
  const difficulties = (body.difficulties || []).filter(item => (DIFFICULTIES as readonly string[]).includes(item))
  const points = await candidatePoints(
    kinds.length ? kinds : [...KINDS],
    levels.length ? levels : [...LEVELS],
    grades,
    difficulties.length ? difficulties : [...DIFFICULTIES]
  )
  const legacyMinutes = body.dailyMinutes == null && (body.newEnergy != null || body.reviewEnergy != null)
    ? Math.round((Number(body.newEnergy || 0) + Number(body.reviewEnergy || 0)) / 4)
    : body.dailyMinutes
  return planCourseDays(points, parseDailyMinutes(legacyMinutes))
}

export async function listCourses(userId: string) {
  await ensureUserDefaultCourse(userId)
  const today = sm2.todayText()
  const rows = await prisma.chineseCourse.findMany({
    where: { userId },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' }
  })
  const results = []
  for (const row of rows) {
    let itemCount = row._count.items
    if (isDefaultCourse(row)) {
      await ensureDefaultSynced(row)
      itemCount = await courseItemCount(row.id)
    }
    const { planned, logs, points } = await planCourseToday(row, userId, today)
    const serialized = serializeCourse(
        row,
        itemCount,
        undefined,
        isDefaultCourse(row) ? itemCount : await matchingPublishedCount(row),
        buildProgress(planned, logs, points.length)
      )
    serialized.entryCount = await courseEntryCount(row.id)
    results.push(serialized)
  }
  return results
}

export async function patchCourse(courseId: string, userId: string, body: { name?: string; note?: string; difficulties?: string[]; dailyMinutes?: number; newEnergy?: number; reviewEnergy?: number; reviewDefaultTest?: boolean }) {
  const course = await ownCourse(courseId, userId)
  const data: { name?: string; note?: string; difficulties?: string; dailyMinutes?: number; newEnergy?: number; reviewEnergy?: number; reviewDefaultTest?: boolean } = {}
  if (body.name != null) {
    const name = String(body.name).trim()
    if (!name) throw new HttpError(400, '请填写课程名称')
    data.name = name
  }
  if (body.note != null) data.note = String(body.note).trim()
  if (body.difficulties != null) {
    const difficulties = body.difficulties.filter(item => (DIFFICULTIES as readonly string[]).includes(item))
    data.difficulties = encodeFilters(difficulties.length ? difficulties : [...DIFFICULTIES], DIFFICULTIES)
  }
  if (body.newEnergy != null) data.newEnergy = parseEnergyLimit(body.newEnergy) || course.newEnergy
  if (body.reviewEnergy != null) data.reviewEnergy = parseEnergyLimit(body.reviewEnergy) || course.reviewEnergy
  if (body.dailyMinutes != null) {
    data.dailyMinutes = parseDailyMinutes(body.dailyMinutes, course.dailyMinutes)
    const halfBudget = Math.max(8, Math.round(minutesToEnergy(data.dailyMinutes) / 2))
    data.newEnergy = halfBudget
    data.reviewEnergy = halfBudget
  }
  if (body.reviewDefaultTest != null) data.reviewDefaultTest = Boolean(body.reviewDefaultTest)
  if (!Object.keys(data).length) throw new HttpError(400, '没有要修改的字段')
  const updated = await prisma.chineseCourse.update({ where: { id: courseId }, data })
  const today = sm2.todayText()
  const { planned, logs, points } = await planCourseToday(updated, userId, today)
  return serializeCourse(
    updated,
    await courseItemCount(courseId),
    undefined,
    await matchingPublishedCount(updated),
    buildProgress(planned, logs, points.length)
  )
}

export async function deleteCourse(courseId: string, userId: string) {
  await ownCourse(courseId, userId)
  await prisma.chineseReviewLog.deleteMany({ where: { userId, courseId } })
  await prisma.chineseReviewState.deleteMany({ where: { userId, courseId } })
  await prisma.chineseCourse.delete({ where: { id: courseId } })
  return { ok: true }
}

export async function syncCourse(courseId: string, userId: string) {
  const course = await ownCourse(courseId, userId)
  const kinds = decodeFilters(course.kinds, KINDS)
  const levels = decodeFilters(course.levels, LEVELS)
  if (!kinds.length || !levels.length) throw new HttpError(400, '旧课程没有筛选条件，请新建课程后再同步')
  const added = await syncCourseItems(course)
  const count = await courseItemCount(courseId)
  const result = serializeCourse(course, count, undefined, await matchingPublishedCount(course))
  return { ...result, added }
}

export async function todayQueue(courseId: string, userId: string, mode?: string, extraMinutes = 0, reciteOffset = 0) {
  const today = sm2.todayText()
  const course = await ensureDefaultSynced(await ownCourse(courseId, userId))
  const { points, logs, planned } = await planCourseToday(course, userId, today, extraMinutes)
    const suggested = resolveDefaultMode(planned as any, course.reviewDefaultTest)
    const active = mode ? normalizeMode(mode) : suggested
    const progress = buildProgress(planned, logs, points.length)
  const reciteGroups = clusterGroups(points.filter(isRecitable))
  const safeReciteOffset = Math.max(0, Math.floor(Number(reciteOffset) || 0))
  const recitePage = reciteGroups
    .slice(safeReciteOffset, safeReciteOffset + 10)
    .map(group => makeSession(group, group.rows))
  const shaped = active === 'recite'
    ? applyTodayMode({ ...planned, groups: recitePage } as any, active)
    : applyTodayMode(planned as any, active)
  const modeCounts = Object.fromEntries(
    MODE_OPTIONS.map(option => [option.id, Number(applyTodayMode(planned as any, option.id).cards || 0)])
  )
  modeCounts.recite = reciteGroups.length
  const hideSource = active === 'test'
    const items = flattenTodayGroups(shaped.groups as any).map(entry => {
    const qtype = String(entry.row.question_type || 'dictation')
    const extra: Record<string, unknown> = {
      groupKey: active === 'test' ? '' : entry.group_key,
      groupSize: entry.group_size,
      groupIndex: entry.group_index,
      taskIndex: entry.task_index,
      taskCount: entry.task_count,
      pointKey: active === 'test' ? '' : entry.row.point_key || '',
      energy: entry.energy,
      groupEnergy: entry.group_energy,
      part: entry.part,
      parts: entry.parts,
      cardTitle: entry.title,
      role: entry.role || 'new',
      mode: active,
      entryKey: active === 'test' ? '' : entry.row.entry_key || '',
      lemma: active === 'test' ? '' : entry.row.lemma || '',
      questionType: qtype,
      audience: entry.row.audience || 'all',
      difficulty: entry.row.difficulty || '',
      options: parseOptions(entry.row.options)
    }
    const showAnswer = active === 'recite' || (qtype === 'recite' && active !== 'test')
    if (showAnswer) {
      extra.answer = entry.row.answer || extra.lemma || ''
      extra.lines = answerLines(extra.answer)
    }
    const item = serializePoint(entry.row, extra)
    if (hideSource) item.source = ''
    return item
  })
  return {
    today,
    items,
    due: shaped.due,
    fresh: shaped.fresh,
    tasks: shaped.tasks,
    cards: shaped.cards,
    newEnergy: shaped.newEnergy,
    reviewEnergy: shaped.reviewEnergy,
    newBudget: shaped.newBudget,
    reviewBudget: shaped.reviewBudget,
    itemCount: points.length,
    courseName: course.name || '',
    isDefault: isDefaultCourse(course),
    mode: active,
    defaultMode: suggested,
    reviewDefaultTest: course.reviewDefaultTest,
    energyCharged: shaped.energyCharged ?? true,
    modes: [...MODE_OPTIONS],
    modeCounts,
    dailyMinutes: course.dailyMinutes || DEFAULT_DAILY_MINUTES,
    targetMinutes: Number((planned as any).targetMinutes || course.dailyMinutes || DEFAULT_DAILY_MINUTES),
    spentMinutes: Number((planned as any).spentMinutes || 0),
    remainingMinutes: active === 'recite'
      ? 0
      : active === 'learn'
        ? Number((planned as any).remainingMinutes || 0)
        : Math.min(
            Math.max(0, Number((planned as any).targetMinutes || 0) - Number((planned as any).spentMinutes || 0)),
            energyToMinutes(Number(shaped.newEnergy || 0) + Number(shaped.reviewEnergy || 0))
          ),
    extraMinutes: Math.max(0, Number(extraMinutes) || 0),
    reciteOffset: safeReciteOffset,
    reciteReturned: recitePage.length,
    reciteTotal: reciteGroups.length,
    reciteHasMore: safeReciteOffset + recitePage.length < reciteGroups.length,
    progress
  }
}

export async function coursePlan(courseId: string, userId: string) {
  const course = await ensureDefaultSynced(await ownCourse(courseId, userId))
  const items = await prisma.chineseCourseItem.findMany({
    where: { courseId },
    include: { point: true },
    orderBy: [{ sort: 'asc' }]
  })
  const points = items.map(item => toPointLike(item.point))
  const plan = planCourseDays(points, course.dailyMinutes || DEFAULT_DAILY_MINUTES)
  return { ...plan, course: serializeCourse(course, points.length) }
}

export async function reviewPoint(courseId: string, userId: string, body: { pointId?: string; answer?: string; reveal?: boolean; mode?: string; selfRating?: string }) {
  const today = sm2.todayText()
  const mode = normalizeMode(body.mode)
  await ownCourse(courseId, userId)
  const item = await prisma.chineseCourseItem.findUnique({
    where: { courseId_pointId: { courseId, pointId: String(body.pointId || '') } },
    include: { point: true }
  })
  if (!item) throw new HttpError(404, '该课程没有这个知识点')
  const state = await prisma.chineseReviewState.findUnique({
    where: { userId_courseId_pointId: { userId, courseId, pointId: item.pointId } }
  })
  const point = toPointLike({ ...item.point, ...state })
  const isNew = !point.last
  const prevState = { n: Number(point.n || 0), ef: Number(point.ef || 2.5), interval: Number(point.interval || 0), lapses: Number(point.lapses || 0) }
  const selfRating = String(body.selfRating || '')
  if (selfRating && String(point.question_type) !== 'recite') throw new HttpError(400, '只有背诵卡可以自评')
  const submittedAnswer = selfRating === 'known' ? point.answer : selfRating === 'again' ? '' : body.answer
  const result = body.reveal ? gradeCard(point, '', true) : gradeCard(point, submittedAnswer, false)
  const outcome = reviewOutcome(mode, result, Boolean(body.reveal))
  if (!outcome.ok) throw new HttpError(400, outcome.error || '不能提交')
  result.quality = Number(outcome.quality || 1)
  result.correct = Boolean(outcome.correct)
  let nextState: sm2.Sm2State = { ...prevState, due: '', last: '' }
  if (outcome.update_sm2) {
    nextState = sm2.schedule(prevState, result.quality, today)
    await prisma.chineseReviewState.upsert({
      where: { userId_courseId_pointId: { userId, courseId, pointId: item.pointId } },
      create: {
        userId,
        courseId,
        pointId: item.pointId,
        n: nextState.n,
        ef: nextState.ef,
        interval: nextState.interval,
        due: sm2.parseDay(nextState.due) || undefined,
        lapses: nextState.lapses,
        last: sm2.parseDay(nextState.last) || undefined
      },
      update: {
        n: nextState.n,
        ef: nextState.ef,
        interval: nextState.interval,
        due: sm2.parseDay(nextState.due) || undefined,
        lapses: nextState.lapses,
        last: sm2.parseDay(nextState.last) || undefined
      }
    })
    await prisma.chineseReviewLog.create({
      data: {
        userId,
        courseId,
        pointId: item.pointId,
        quality: result.quality,
        isNew,
        correct: result.correct
      }
    })
  }
  return {
    ...result,
    answer: point.answer,
    lines: answerLines(point.answer),
    state: nextState,
    isNew,
    mode,
    updateSm2: outcome.update_sm2,
    revealed: Boolean(body.reveal),
    feedback: kidFeedback(mode, result, Boolean(body.reveal), outcome.update_sm2)
  }
}

export async function courseStats(courseId: string, userId: string) {
  const today = sm2.todayText()
  const course = await ensureDefaultSynced(await ownCourse(courseId, userId))
  const items = await prisma.chineseCourseItem.findMany({
    where: { courseId },
    include: { point: true },
    orderBy: [{ sort: 'asc' }]
  })
  const states = await prisma.chineseReviewState.findMany({ where: { userId, courseId } })
  const logs = await prisma.chineseReviewLog.findMany({ where: { userId, courseId } })
  const userLogs = await prisma.chineseReviewLog.findMany({
    where: { userId },
    select: { courseId: true, pointId: true }
  })
  const logPointIds = Array.from(new Set(userLogs.map(item => item.pointId)))
  const logPoints = logPointIds.length
    ? await prisma.chinesePublished.findMany({
        where: { id: { in: logPointIds } },
        select: { id: true, entryKey: true }
      })
    : []
  const entryByPoint = new Map(logPoints.map(item => [item.id, item.entryKey || '']))
  const coursesByEntry = new Map<string, Set<string>>()
  for (const log of userLogs) {
    const entryKey = entryByPoint.get(log.pointId)
    if (!entryKey) continue
    const set = coursesByEntry.get(entryKey) || new Set<string>()
    set.add(log.courseId)
    coursesByEntry.set(entryKey, set)
  }
  const stateMap = new Map(states.map(item => [item.pointId, item]))
  const logByPoint = new Map<string, typeof logs>()
  for (const log of logs) {
    const list = logByPoint.get(log.pointId) || []
    list.push(log)
    logByPoint.set(log.pointId, list)
  }
  const serialized = items.map(item => {
    const state = stateMap.get(item.pointId)
    const pointLogs = logByPoint.get(item.pointId) || []
    const passCount = item.point.entryKey ? coursesByEntry.get(item.point.entryKey)?.size || 0 : 0
    const row = {
      id: item.point.id,
      kind: item.point.kind,
      level: item.point.level,
      grade: item.point.grade,
      prompt: item.point.prompt,
      source: item.point.source,
      entry_key: item.point.entryKey,
      lemma: item.point.lemma,
      question_type: item.point.questionType,
      n: state?.n || 0,
      interval: state?.interval || 0,
      due: asDay(state?.due) || null,
      lapses: state?.lapses || 0,
      last: asDay(state?.last) || null,
      study_count: pointLogs.filter(log => log.isNew).length,
      review_count: pointLogs.filter(log => !log.isNew).length,
      error_count: pointLogs.filter(log => !log.correct).length,
      passCount,
      pass_count: passCount,
      mastered: sm2.isMastered(state ? { n: state.n, interval: state.interval } : null)
    }
    return row
  })
  const { points, logs: todayLogs, planned } = await planCourseToday(course, userId, today)
  const mastery = masteryCounts(serialized)
  let progress = buildProgress(planned, todayLogs, points.length, mastery.mastered, mastery.total)
  if (!progress.weakKinds.length) {
    progress = {
      ...progress,
      weakKinds: mastery.weakKinds,
      summary: parentCopy(
        progress.status,
        progress.todayPracticed,
        progress.todayAccuracy,
        mastery.weakKinds,
        progress.remainingNewEnergy,
        progress.remainingReviewEnergy,
        mastery.mastered,
        mastery.total
      )
    }
  }
  return {
    items: serialized,
    today: progress,
    mastery,
    summary: progress.summary,
    courseName: course.name,
    reviewDefaultTest: course.reviewDefaultTest
  }
}

export async function libraryCoverage(userId: string) {
  const [total, entries, inCourse, studied, mastered, byKindRaw, byGradeRaw, gradeLinks] = await Promise.all([
    prisma.chinesePublished.count(),
    prisma.chinesePublished.findMany({ select: { id: true, entryKey: true, kind: true, grade: true } }),
    prisma.chineseCourseItem.findMany({
      where: { course: { userId } },
      select: { pointId: true }
    }),
    prisma.chineseReviewLog.findMany({ where: { userId }, select: { pointId: true } }),
    prisma.chineseReviewState.findMany({ where: { userId } }),
    prisma.chinesePublished.groupBy({ by: ['kind'], _count: { id: true } }),
    prisma.chinesePublished.groupBy({ by: ['grade'], _count: { id: true } }),
    prisma.chineseEntryGrade.findMany()
  ])
  const entryCount = new Set(entries.map(item => item.entryKey || `id:${item.id}`)).size
  const inCourseIds = new Set(inCourse.map(item => item.pointId))
  const studiedIds = new Set(studied.map(item => item.pointId))
  const studiedEntries = new Set(
    entries.filter(item => studiedIds.has(item.id)).map(item => item.entryKey || `id:${item.id}`)
  ).size
  const masteredCount = mastered.filter(item => item.interval >= 21 || item.n >= 5).length
  const byKind = byKindRaw.map(row => ({
    kind: row.kind,
    total: row._count.id,
    entries: new Set(entries.filter(item => item.kind === row.kind).map(item => item.entryKey || `id:${item.id}`)).size,
    in_course: entries.filter(item => item.kind === row.kind && inCourseIds.has(item.id)).length
  }))
  const byGrade = byGradeRaw.map(row => ({
    grade: row.grade || '未分年级',
    total: row._count.id,
    entries: new Set(entries.filter(item => (item.grade || '') === row.grade).map(item => item.entryKey || `id:${item.id}`)).size,
    in_course: entries.filter(item => (item.grade || '') === row.grade && inCourseIds.has(item.id)).length
  }))
  const publishedByEntry = new Map<string, typeof entries>()
  for (const item of entries) {
    if (!item.entryKey) continue
    const list = publishedByEntry.get(item.entryKey) || []
    list.push(item)
    publishedByEntry.set(item.entryKey, list)
  }
  const byEntryGradeMap = new Map<string, { grade: string; entries: Set<string>; total: Set<string>; inCourse: Set<string> }>()
  for (const link of gradeLinks) {
    const bucket = byEntryGradeMap.get(link.grade) || {
      grade: link.grade,
      entries: new Set<string>(),
      total: new Set<string>(),
      inCourse: new Set<string>()
    }
    bucket.entries.add(link.entryKey)
    for (const card of publishedByEntry.get(link.entryKey) || []) {
      bucket.total.add(card.id)
      if (inCourseIds.has(card.id)) bucket.inCourse.add(card.id)
    }
    byEntryGradeMap.set(link.grade, bucket)
  }
  const byEntryGrade = [...GRADES]
    .filter(grade => byEntryGradeMap.has(grade))
    .map(grade => {
      const row = byEntryGradeMap.get(grade)!
      return { grade, entries: row.entries.size, total: row.total.size, in_course: row.inCourse.size }
    })
  return {
    total,
    entryCount,
    inCourse: inCourseIds.size,
    studied: studiedIds.size,
    studiedEntries,
    mastered: masteredCount,
    byKind,
    byGrade,
    byEntryGrade
  }
}

export async function listResources(isAdmin: boolean, userId: string) {
  const rows = isAdmin
    ? await prisma.chineseResource.findMany({ orderBy: { createdAt: 'desc' } })
    : await prisma.chineseResource.findMany({
        where: { OR: [{ ownerType: 'official' }, { ownerType: 'user', uploadedBy: userId }] },
        orderBy: { createdAt: 'desc' }
      })
  const statusBySlug: Record<string, Awaited<ReturnType<typeof packStatus>>> = {}
  if (isAdmin) {
    for (const spec of PACKS) statusBySlug[spec.slug] = await packStatus(spec)
  }
  return rows.map(row => {
    const item = decorateResource(row, statusBySlug)
    if (!isAdmin) delete (item as { path?: string }).path
    return item
  })
}

export async function patchPublished(pointId: string, body: Record<string, unknown>) {
  const row = await prisma.chinesePublished.findUnique({ where: { id: pointId } })
  if (!row) throw new HttpError(404, '知识点不存在')
  const merged = {
    kind: String(body.kind ?? row.kind),
    level: String(body.level ?? row.level),
    grade: normalizeGrade(body.grade ?? row.grade),
    prompt: String(body.prompt ?? row.prompt),
    answer: String(body.answer ?? row.answer),
    tags: String(body.tags ?? row.tags),
    source: String(body.source ?? row.source),
    entry_key: String(body.entryKey ?? body.entry_key ?? row.entryKey),
    lemma: String(body.lemma ?? row.lemma),
    question_type: String(body.questionType ?? body.question_type ?? row.questionType),
    audience: String(body.audience ?? row.audience),
    difficulty: String(body.difficulty ?? row.difficulty),
    active: body.active == null ? row.isActive : Boolean(body.active),
    options: body.options ?? row.options,
    key: row.pointKey || ''
  }
  if (!isKind(merged.kind) || !isLevel(merged.level)) throw new HttpError(400, '类型或级别无效')
  const error = validateCard(merged.kind, merged.prompt, merged.answer, merged.question_type, merged.lemma)
  if (error) throw new HttpError(400, error)
  const grouped = fillGroupFields(merged)
  await upsertEntry(grouped)
  const updated = await prisma.chinesePublished.update({
    where: { id: pointId },
    data: {
      kind: grouped.kind,
      level: grouped.level,
      grade: String(grouped.grade || ''),
      prompt: String(grouped.prompt),
      answer: String(grouped.answer),
      tags: String(grouped.tags || ''),
      source: String(grouped.source || ''),
      groupKey: String(grouped.group_key || ''),
      subGroupKey: String(grouped.sub_group_key || ''),
      entryKey: String(grouped.entry_key || ''),
      lemma: String(grouped.lemma || ''),
      questionType: String(grouped.question_type || 'dictation'),
      audience: String(grouped.audience || 'all'),
      difficulty: String(grouped.difficulty || ''),
      isActive: grouped.active !== false,
      options: String(grouped.options || '')
    }
  })
  return updated
}
