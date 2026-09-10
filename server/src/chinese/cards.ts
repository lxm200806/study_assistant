import { createHash } from 'crypto'
import {
  DAILY_MINUTES_MAX,
  DAILY_MINUTES_MIN,
  DEFAULT_DAILY_MINUTES,
  DEFAULT_NEW_ENERGY,
  ENERGY_MAX,
  ENERGY_MIN,
  ENERGY_PER_MINUTE,
  GRADES,
  KINDS,
  LEVELS,
  PAGE_DEFAULT,
  PAGE_MAX,
  PLAN_MAX_DAYS,
  PLAN_QUALITY,
  SOLO_KINDS,
  isKind,
  isLevel,
  normalizeQuestionType,
  type PointLike
} from './constants'
import { fillEntryFields, lemmaOf, normalizeAudience, normalizeDifficulty, normalizeQuestionType as nq } from './entries'
import { normalize } from './grade'
import * as sm2 from './sm2'

const CITATION_SUFFIX = /·《[^》]+》$/
const UNLINKED_RESOURCE_TOKENS = new Set(['0', 'unlinked', 'none'])
const ALL_RESOURCE_TOKENS = new Set(['', 'all', '*', 'undefined', 'null'])

export function encodeFilters(values: string[] | null | undefined, allowed: readonly string[]): string {
  return (values || []).filter(item => (allowed as readonly string[]).includes(item)).join(',')
}

export function decodeFilters(text: unknown, allowed: readonly string[]): string[] {
  return String(text || '')
    .split(',')
    .map(item => item.trim())
    .filter(item => (allowed as readonly string[]).includes(item))
}

export function parseResourceFilter(resourceId?: unknown, unlinked = false): number | string | null {
  if (unlinked) return 0
  const text = resourceId == null ? '' : String(resourceId).trim()
  const lowered = text.toLowerCase()
  if (ALL_RESOURCE_TOKENS.has(lowered)) return null
  if (UNLINKED_RESOURCE_TOKENS.has(lowered)) return 0
  return text || null
}

export function pageArgs(limit: unknown, offset: unknown): [number, number] {
  const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : PAGE_DEFAULT
  const safeOffset = Number.isFinite(Number(offset)) ? Number(offset) : 0
  return [Math.min(Math.max(safeLimit, 1), PAGE_MAX), Math.max(safeOffset, 0)]
}

export function validateCard(kind: string, prompt: unknown, answer: unknown, questionType = 'dictation', lemma = ''): string | null {
  if (!isKind(kind)) return '类型无效，仅支持 poem / wenyan / idiom / saying / sentence / zi'
  const qtype = normalizeQuestionType(questionType)
  if (!String(prompt || '').trim() || !String(answer || '').trim()) return '提示和答案必填'
  if (qtype === 'char_judge' || qtype === 'usage_judge') {
    const compact = normalize(answer)
    if (compact !== '对' && compact !== '错') return '判断题答案须为对或错'
    return null
  }
  if (['pinyin_choice', 'spelling_choice', 'meaning_choice', 'context_choice'].includes(qtype)) return null
  const compact = normalize(answer)
  if (kind === 'zi' && compact.length !== 1) return '易错字答案必须是一个字'
  if (kind === 'idiom' && (compact.length < 3 || compact.length > 8)) return '词语过长，请拆成一条'
  if (kind === 'saying' && compact.length > 40) return '俗语名句过长，请拆成一条'
  if (kind === 'poem' && compact.length > 80) return '古诗卡片过大，请拆成名句或短篇'
  if (kind === 'wenyan' && compact.length > 160) return '文言文卡片过大，请拆成一段'
  if (kind === 'sentence' && compact.length > 120) return '优美句子过长，请拆成一句'
  void lemma
  return null
}

export function normalizeGrade(value: unknown): string {
  const text = String(value || '').trim()
  return (GRADES as readonly string[]).includes(text) ? text : ''
}

export function fillGroupFields(point: PointLike): PointLike {
  const filled = fillEntryFields({ ...point })
  const explicitGroup = String(filled.group || '').trim()
  const explicitSub = String(filled.sub_group || '').trim()
  const entryKey = String(filled.entry_key || '').trim()
  filled.group_key = entryKey || explicitGroup || deriveGroupKey(filled)
  filled.sub_group_key = explicitSub || String(filled.question_type || '')
  return filled
}

export function normalizePoint(item: unknown): PointLike | null {
  if (!item || typeof item !== 'object') return null
  const raw = item as PointLike
  const kind = isKind(String(raw.kind || '')) ? String(raw.kind) : 'poem'
  const level = isLevel(String(raw.level || '')) ? String(raw.level) : 'L1'
  const prompt = String(raw.prompt || '').trim()
  const answer = String(raw.answer || '').trim()
  const qtype = normalizeQuestionType(raw.question_type || raw.questionType)
  let lemma = String(raw.lemma || '').trim()
  if (!lemma) lemma = lemmaOf({ question_type: qtype, answer, lemma: '' })
  const error = validateCard(kind, prompt, answer, qtype, lemma)
  if (error) return null
  return fillGroupFields({
    key: String(raw.key || raw.point_key || raw.pointKey || '').trim(),
    kind,
    level,
    grade: normalizeGrade(raw.grade),
    prompt,
    answer,
    tags: String(raw.tags || '').trim(),
    source: String(raw.source || '').trim(),
    group: String(raw.group || '').trim(),
    sub_group: String(raw.sub_group || '').trim(),
    entry_key: String(raw.entry_key || raw.entryKey || '').trim(),
    lemma,
    question_type: qtype,
    audience: normalizeAudience(raw.audience),
    difficulty: normalizeDifficulty(raw.difficulty),
    active: raw.active !== false && raw.isActive !== false,
    options: raw.options
  })
}

export function parseImport(text: unknown): { ok: PointLike[]; skip: number } {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim()
  if (!raw) return { ok: [], skip: 0 }
  if (raw[0] === '[' || raw[0] === '{') {
    try {
      const data = JSON.parse(raw)
      if (Array.isArray(data)) return collectRows(data)
      if (data && typeof data === 'object' && Array.isArray(data.points)) return collectRows(data.points)
      return { ok: [], skip: 1 }
    } catch {
      return { ok: [], skip: 1 }
    }
  }
  return collectRows(parseCsv(raw))
}

function collectRows(rows: unknown[]): { ok: PointLike[]; skip: number } {
  if (!Array.isArray(rows)) return { ok: [], skip: 1 }
  const ok: PointLike[] = []
  let skip = 0
  for (const row of rows) {
    const point = normalizePoint(row)
    if (point) ok.push(point)
    else skip += 1
  }
  return { ok, skip }
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const headers = splitCsvLine(lines[0])
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((key, index) => {
      row[key.trim()] = (values[index] || '').trim()
    })
    return row
  })
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export function tagTheme(tags: unknown): string {
  return String(tags || '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(';')
}

export function moduleSource(source: unknown): string {
  return String(source || '').trim().replace(CITATION_SUFFIX, '')
}

export function deriveGroupKey(point: PointLike): string {
  const kind = String(point.kind || '')
  const key = String(point.key || point.point_key || point.pointKey || '').trim()
  if (SOLO_KINDS.has(kind)) {
    if (key) return key
    const payload = [point.grade || '', kind, point.prompt || '', point.answer || ''].join('|')
    return `solo-${createHash('sha1').update(payload).digest('hex').slice(0, 12)}`
  }
  const payload = [point.grade || '', kind, moduleSource(point.source), tagTheme(point.tags)].join('|')
  return `g1-${createHash('sha1').update(payload).digest('hex').slice(0, 12)}`
}

export function rowGroupKey(row: PointLike): string {
  return String(row.group_key || row.groupKey || row.point_key || row.pointKey || row.id || '')
}

export interface ClusterGroup {
  group_key: string
  rows: PointLike[]
}

export function clusterGroups(rows: PointLike[]): ClusterGroup[] {
  const groups: ClusterGroup[] = []
  const seen = new Map<string, ClusterGroup>()
  for (const row of rows) {
    const key = rowGroupKey(row)
    let group = seen.get(key)
    if (!group) {
      group = { group_key: key, rows: [] }
      seen.set(key, group)
      groups.push(group)
    }
    group.rows.push(row)
  }
  return groups
}

export function parseEnergyLimit(value: unknown, fallback: number | null = DEFAULT_NEW_ENERGY): number | null {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  if (fallback == null) return Math.min(Math.max(number, ENERGY_MIN), ENERGY_MAX)
  return Math.min(Math.max(number, ENERGY_MIN), ENERGY_MAX)
}

export function parseDailyMinutes(value: unknown, fallback = DEFAULT_DAILY_MINUTES): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.round(Math.min(Math.max(number, DAILY_MINUTES_MIN), DAILY_MINUTES_MAX))
}

export function minutesToEnergy(minutes: unknown): number {
  return parseDailyMinutes(minutes) * ENERGY_PER_MINUTE
}

export function energyToMinutes(energy: unknown): number {
  const number = Math.max(0, Number(energy) || 0)
  return number ? Math.max(1, Math.ceil(number / ENERGY_PER_MINUTE)) : 0
}

export function energyOverflow(daily: number): number {
  return Math.max(6, Math.floor(Number(daily) / 5))
}

export function pointEnergy(point: PointLike): number {
  const raw = point.energy
  if (raw != null && String(raw).trim() !== '') {
    const value = Number(raw)
    if (Number.isFinite(value) && value > 0) return value
  }
  const qtype = nq(point.question_type || point.questionType)
  const kind = point.kind
  if (qtype === 'char_judge') return kind === 'idiom' ? 2 : 1
  if (qtype === 'usage_judge') return kind === 'idiom' ? 4 : 2
  if (['pinyin_choice', 'spelling_choice', 'meaning_choice', 'context_choice'].includes(qtype)) {
    return kind === 'idiom' ? 4 : 2
  }
  const tags = String(point.tags || '')
  const length = normalize(point.lemma || point.answer || '').length
  if (qtype === 'recite' && kind === 'idiom') return 2
  if (kind === 'zi') return 1
  if (kind === 'idiom') return tags.includes('成语') ? 4 : 2
  if (kind === 'saying') return length <= 16 ? 4 : 8
  if (kind === 'sentence') return length <= 40 ? 8 : 12
  if (kind === 'poem') {
    if (length <= 24) return 16
    if (length <= 48) return 24
    return 32
  }
  if (kind === 'wenyan') {
    if (length <= 40) return 24
    if (length <= 80) return 32
    if (length <= 120) return 64
    return 96
  }
  return 4
}

export function rowsEnergy(rows: PointLike[]): number {
  return rows.reduce((sum, row) => sum + pointEnergy(row), 0)
}

export function sessionDays(energy: number, daily: number): number {
  const limit = Number(daily) + energyOverflow(daily)
  if (energy <= limit) return 1
  return Math.max(2, Math.ceil(energy / Number(daily)))
}

export interface StudySession {
  group_key: string
  rows: PointLike[]
  energy: number
  part: number
  parts: number
  kind: string
  grade: string
  source: string
  title: string
  role?: string
}

export function makeSession(group: ClusterGroup, rows: PointLike[], part = 1, parts = 1): StudySession {
  const first = rows[0] || {}
  const source = String(first.source || '').trim()
  return {
    group_key: group.group_key,
    rows: [...rows],
    energy: rowsEnergy(rows),
    part,
    parts,
    kind: String(first.kind || ''),
    grade: String(first.grade || ''),
    source,
    title: source || String(first.prompt || '学习卡')
  }
}

export function expandSessions(groups: ClusterGroup[], daily: number): StudySession[] {
  const sessions: StudySession[] = []
  const limit = Number(daily) + energyOverflow(daily)
  for (const group of groups) {
    const rows = [...group.rows]
    const energy = rowsEnergy(rows)
    const days = sessionDays(energy, daily)
    if (days === 1) {
      sessions.push(makeSession(group, rows))
      continue
    }
    if (rows.length === 1) {
      for (let part = 1; part <= days; part++) {
        const session = makeSession(group, rows, part, days)
        session.energy = Math.min(Number(daily), energy - (part - 1) * Number(daily)) || Number(daily)
        sessions.push(session)
      }
      continue
    }
    const chunks: PointLike[][] = []
    let chunk: PointLike[] = []
    let chunkEnergy = 0
    for (const row of rows) {
      const cost = pointEnergy(row)
      if (chunk.length && chunkEnergy + cost > limit) {
        chunks.push(chunk)
        chunk = []
        chunkEnergy = 0
      }
      chunk.push(row)
      chunkEnergy += cost
    }
    if (chunk.length) chunks.push(chunk)
    const parts = Math.max(chunks.length, 1)
    chunks.forEach((piece, index) => sessions.push(makeSession(group, piece, index + 1, parts)))
  }
  return sessions
}

export function packOneDay(sessions: StudySession[], daily: number): [StudySession[], number] {
  const limit = Number(daily) + energyOverflow(daily)
  const picked: StudySession[] = []
  let used = 0
  for (const session of sessions) {
    const cost = session.energy
    if (picked.length && used + cost > limit) break
    picked.push(session)
    used += cost
  }
  return [picked, used]
}

function packWithin(sessions: StudySession[], limit: number, allowOversizedFirst = true): [StudySession[], number] {
  if (limit <= 0) return [[], 0]
  const picked: StudySession[] = []
  let used = 0
  for (const session of sessions) {
    if (!picked.length && session.energy > limit && !allowOversizedFirst) break
    if (picked.length && used + session.energy > limit) break
    picked.push(session)
    used += session.energy
    if (used >= limit) break
  }
  return [picked, used]
}

export function rowId(row: PointLike): string {
  if (row.id != null) return String(row.id)
  return String(row.point_key || row.pointKey || row.key || '')
}

export function sessionCompletesPoints(session: StudySession): boolean {
  if (session.rows.length === 1 && Number(session.parts || 1) > 1) {
    return Number(session.part || 1) >= Number(session.parts || 1)
  }
  return true
}

function serializePlanDays(days: Array<{ day?: number; sessions: StudySession[]; energy?: number; new_energy?: number; review_energy?: number }>) {
  return days.map((day, index) => {
    const cards = day.sessions.map(session => {
      const count = session.rows.length
      const role = session.role || 'new'
      const first = session.rows[0] || {}
      const recite = session.rows.find(row => String(row.question_type || row.questionType) === 'recite')
      const knowledgePoint = String(
        first.kind === 'idiom'
          ? first.lemma || first.answer || first.prompt || session.title
          : first.prompt || first.lemma || first.answer || session.title
      )
      const summary = String(
        first.kind === 'idiom'
          ? recite?.prompt || first.prompt || ''
          : session.source || first.lemma || ''
      ).replace(/（四字）$/, '')
      return {
        title: session.title,
        knowledgePoint,
        summary,
        groupKey: session.group_key,
        kind: session.kind,
        grade: session.grade,
        source: session.source,
        energy: session.energy,
        estimatedMinutes: energyToMinutes(session.energy),
        pointCount: count,
        questionCount: count,
        part: session.part,
        parts: session.parts,
        role,
        prompts: session.rows.slice(0, 8).map(row => String(row.prompt || '')),
        entries: session.rows.slice(0, 8).map(row => ({
          prompt: String(row.prompt || ''),
          lemma: String(row.lemma || ''),
          questionType: String(row.question_type || row.questionType || 'dictation')
        }))
      }
    })
    let newEnergy = day.new_energy
    let reviewEnergy = day.review_energy
    if (newEnergy == null) newEnergy = cards.filter(item => item.role !== 'review').reduce((sum, item) => sum + item.energy, 0)
    if (reviewEnergy == null) reviewEnergy = cards.filter(item => item.role === 'review').reduce((sum, item) => sum + item.energy, 0)
    const mode = reviewEnergy && newEnergy ? 'mixed' : reviewEnergy ? 'review' : 'new'
    const pointCount = cards.reduce((sum, item) => sum + item.pointCount, 0)
    return {
      day: day.day || index + 1,
      mode,
      energy: day.energy != null ? day.energy : newEnergy + reviewEnergy,
      estimatedMinutes: energyToMinutes(day.energy != null ? day.energy : newEnergy + reviewEnergy),
      newEnergy,
      reviewEnergy,
      pointCount,
      newPointCount: cards.filter(item => item.role !== 'review').reduce((sum, item) => sum + item.pointCount, 0),
      reviewPointCount: cards.filter(item => item.role === 'review').reduce((sum, item) => sum + item.pointCount, 0),
      cardCount: day.sessions.length,
      cards
    }
  })
}

export function planCourseDays(rows: PointLike[], dailyMinutes: unknown = DEFAULT_DAILY_MINUTES) {
  const minutes = parseDailyMinutes(dailyMinutes)
  const dailyBudget = minutesToEnergy(minutes)
  const dailyLimit = dailyBudget
  let remainingNew = expandSessions(clusterGroups(rows), dailyBudget)
  const states = new Map<string, ReturnType<typeof sm2.schedule>>()
  const days: Array<{ day: number; sessions: StudySession[]; energy: number; new_energy: number; review_energy: number }> = []
  let newDayCount = 0
  const start = '2000-01-01'
  for (let offset = 0; offset < PLAN_MAX_DAYS; offset++) {
    const today = sm2.addDays(start, offset)
    const dueRows = rows.filter(row => {
      const state = states.get(rowId(row))
      if (!state || sm2.isMastered(state)) return false
      return String(state.due || '') <= today
    })
    const reviewSessions = expandSessions(clusterGroups(dueRows), dailyBudget)
    for (const session of reviewSessions) session.role = 'review'
    const [reviewToday, reviewUsed] = packWithin(reviewSessions, dailyLimit)
    let newToday: StudySession[] = []
    let newUsed = 0
    if (remainingNew.length) {
      remainingNew = remainingNew.filter(session => !session.rows.every(row => states.has(rowId(row))))
      ;[newToday, newUsed] = packWithin(remainingNew, Math.max(0, dailyLimit - reviewUsed))
      remainingNew = remainingNew.slice(newToday.length)
      for (const session of newToday) session.role = 'new'
    }
    if (!reviewToday.length && !newToday.length) {
      if (remainingNew.length) continue
      if ([...states.values()].some(state => state && !sm2.isMastered(state))) continue
      break
    }
    for (const session of [...reviewToday, ...newToday]) {
      if (session.role === 'new' && !sessionCompletesPoints(session)) continue
      for (const row of session.rows) {
        const key = rowId(row)
        states.set(key, sm2.schedule(states.get(key), PLAN_QUALITY, today))
      }
    }
    if (newToday.length) newDayCount += 1
    days.push({
      day: offset + 1,
      sessions: [...reviewToday, ...newToday],
      energy: reviewUsed + newUsed,
      new_energy: newUsed,
      review_energy: reviewUsed
    })
  }
  return {
    dailyMinutes: minutes,
    dailyEnergy: dailyBudget,
    newEnergy: dailyBudget,
    reviewEnergy: dailyBudget,
    groupCount: clusterGroups(rows).length,
    pointCount: rows.length,
    totalEnergy: rowsEnergy(rows),
    dayCount: days.length,
    newDayCount,
    calendarDays: days.length ? days[days.length - 1].day : 0,
    days: serializePlanDays(days)
  }
}

export function planTodayGroups(
  rows: PointLike[],
  failedIds: Set<unknown>,
  today: string,
  dailyMinutes: unknown = DEFAULT_DAILY_MINUTES,
  spentEnergy: unknown = 0,
  extraMinutes: unknown = 0
) {
  const baseMinutes = parseDailyMinutes(dailyMinutes)
  const extensionMinutes = Math.max(0, Math.min(Number(extraMinutes) || 0, DAILY_MINUTES_MAX))
  const targetMinutes = baseMinutes + extensionMinutes
  const dailyBudget = targetMinutes * ENERGY_PER_MINUTE
  const spent = Math.max(0, Number(spentEnergy) || 0)
  const available = Math.max(0, dailyBudget - spent)
  const limit = available
  const dueRows: PointLike[] = []
  const failedRows: PointLike[] = []
  const freshRows: PointLike[] = []
  for (const row of rows) {
    if (!row.last) freshRows.push(row)
    else if (String(row.due || '') <= today) dueRows.push(row)
    else if (failedIds.has(row.id)) failedRows.push(row)
  }
  const reviewSessions = expandSessions([...clusterGroups(dueRows), ...clusterGroups(failedRows)], dailyBudget)
  const freshSessions = expandSessions(clusterGroups(freshRows), dailyBudget)
  const allowOversized = spent <= 0 || extensionMinutes > 0
  const [reviewToday, reviewUsed] = packWithin(reviewSessions, limit, allowOversized)
  const [freshToday, freshUsed] = packWithin(
    freshSessions,
    Math.max(0, limit - reviewUsed),
    allowOversized && reviewUsed <= 0
  )
  for (const session of reviewToday) session.role = 'review'
  for (const session of freshToday) session.role = 'new'
  const picked = [...reviewToday, ...freshToday]
  return {
    groups: picked,
    due: clusterGroups(dueRows).length,
    failed: clusterGroups(failedRows).length,
    fresh: clusterGroups(freshRows).length,
    tasks: picked.length,
    cards: picked.reduce((sum, session) => sum + session.rows.length, 0),
    newEnergy: freshUsed,
    reviewEnergy: reviewUsed,
    newBudget: dailyBudget,
    reviewBudget: dailyBudget,
    dailyMinutes: baseMinutes,
    targetMinutes,
    extraMinutes: extensionMinutes,
    spentMinutes: energyToMinutes(spent),
    remainingMinutes: Math.min(
      Math.max(0, targetMinutes - energyToMinutes(spent)),
      energyToMinutes(reviewUsed + freshUsed)
    )
  }
}

export function flattenTodayGroups(groups: StudySession[]) {
  const items: Array<{
    row: PointLike
    group_key: string
    group_size: number
    group_index: number
    task_index: number
    task_count: number
    energy: number
    group_energy: number
    part: number
    parts: number
    title: string
    role: string
  }> = []
  const taskCount = groups.length
  groups.forEach((group, taskIndex) => {
    const size = group.rows.length
    group.rows.forEach((row, groupIndex) => {
      items.push({
        row,
        group_key: group.group_key,
        group_size: size,
        group_index: groupIndex + 1,
        task_index: taskIndex + 1,
        task_count: taskCount,
        energy: pointEnergy(row),
        group_energy: group.energy || rowsEnergy(group.rows),
        part: group.part || 1,
        parts: group.parts || 1,
        title: group.title || '',
        role: group.role || 'new'
      })
    })
  })
  return items
}

export { KINDS, LEVELS, GRADES }
