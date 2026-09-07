import { createHash } from 'crypto'
import {
  AUDIENCES,
  GRADES,
  LEVELS,
  LOWER_GRADES,
  MID_GRADES,
  SOLO_KINDS,
  UPPER_GRADES,
  normalizeAudience,
  normalizeQuestionType,
  type PointLike
} from './constants'
import { normalize } from './grade'

export { normalizeAudience, normalizeQuestionType }

const HINT_MARKERS = ['形容', '比喻', '描写', '意思', '指', '表示']
const SUFFIX_HINT = /（四字）$|（成语）$|（词语）$/
const CONFUSABLES: Record<string, string> = {
  己: '已',
  已: '己',
  未: '末',
  末: '未',
  土: '士',
  士: '土',
  入: '人',
  人: '入',
  天: '夭',
  大: '太',
  太: '大',
  干: '千',
  千: '干',
  辩: '辨',
  辨: '辩',
  即: '既',
  既: '即',
  侯: '候',
  候: '侯',
  蓝: '篮',
  篮: '蓝',
  厉: '历',
  历: '厉',
  坐: '座',
  座: '坐',
  象: '像',
  像: '象',
  做: '作',
  作: '做',
  那: '哪',
  哪: '那',
  到: '道',
  道: '到',
  必: '心',
  心: '必',
  成: '城',
  城: '成',
  不: '步',
  无: '天',
  有: '友',
  言: '信',
  信: '言',
  清: '青',
  青: '清',
  秀: '绣',
  自: '字',
  语: '悟',
  春: '椿',
  回: '徊',
  地: '第',
  万: '方',
  物: '勿',
  复: '覆',
  苏: '酥'
}
const GENERIC_HINTS = ['形容情况很好', '形容心情不好', '做事很认真', '景色很美丽']

export function encodeOptions(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value).trim()
}

export function parseOptions(value: unknown): unknown {
  if (value && typeof value === 'object') return value
  const text = String(value || '').trim()
  if (!text) return {}
  try {
    const data = JSON.parse(text)
    if (data && (typeof data === 'object' || Array.isArray(data))) return data
  } catch {
    return { display: text }
  }
  return {}
}

export function stableInt(text: unknown): number {
  const digest = createHash('sha1').update(String(text || '')).digest('hex').slice(0, 8)
  return parseInt(digest, 16)
}

export function makeEntryKey(kind: string, lemma: string, fallback = ''): string {
  const safeKind = String(kind || '').trim()
  const safeLemma = String(lemma || '').trim()
  const safeFallback = String(fallback || '').trim()
  if (SOLO_KINDS.has(safeKind) && safeFallback) return safeFallback
  const compact = normalize(safeLemma) || safeLemma
  if (safeKind && compact) return `${safeKind}:${compact}`
  return safeFallback
}

export function lemmaOf(point: PointLike | null | undefined): string {
  const text = String(point?.lemma || '').trim()
  if (text) return text
  const qtype = normalizeQuestionType(point?.question_type || point?.questionType)
  const answer = String(point?.answer || '').trim()
  if (qtype === 'char_judge' || qtype === 'meaning_choice') return ''
  return answer
}

export function meaningHint(point: PointLike | null | undefined): string {
  return String(point?.prompt || '').replace(SUFFIX_HINT, '').trim()
}

export function looksLikeMeaning(point: PointLike | null | undefined): boolean {
  const hint = meaningHint(point)
  if (hint.length < 4) return false
  return HINT_MARKERS.some(marker => hint.includes(marker)) || String(point?.prompt || '').includes('（四字）')
}

export function splitLabels(text: unknown): string[] {
  const items: string[] = []
  for (const raw of String(text || '').replace(/，/g, ';').replace(/,/g, ';').split(';')) {
    const item = raw.trim()
    if (item && !items.includes(item)) items.push(item)
  }
  return items
}

export function mergeLabels(old: unknown, extra: unknown, order?: readonly string[]): string[] {
  const items = splitLabels(old)
  for (const item of splitLabels(extra)) {
    if (!items.includes(item)) items.push(item)
  }
  if (order) {
    const rank = new Map(order.map((name, index) => [name, index]))
    items.sort((a, b) => (rank.get(a) ?? rank.size) - (rank.get(b) ?? rank.size) || a.localeCompare(b, 'zh'))
  }
  return items
}

export function joinLabels(items: string[]): string {
  return items.filter(Boolean).join(';')
}

export function cardRank(row: PointLike, selectedGrades?: string[]): [number, number, number] {
  const selected = new Set((selectedGrades || []).filter(Boolean).map(String))
  const grade = String(row?.grade || '')
  const gradeScore = selected.size ? (selected.has(grade) ? 2 : grade ? 1 : 0) : grade ? 1 : 0
  const level = String(row?.level || '')
  const levelScore = (LEVELS as readonly string[]).includes(level)
    ? (LEVELS as readonly string[]).indexOf(level)
    : LEVELS.length
  const rowId = Number(row?.id || 0) || 0
  return [-gradeScore, levelScore, rowId]
}

function rankLess(left: [number, number, number], right: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] < right[i]
  }
  return false
}

export function pickCourseCards(rows: PointLike[] | null | undefined, grades?: string[]): PointLike[] {
  const selected = (grades || []).filter(Boolean).map(String)
  const best = new Map<string, PointLike>()
  for (const row of rows || []) {
    const entryKey = String(row.entry_key || row.entryKey || '') || `id:${row.id ?? ''}`
    const qtype = normalizeQuestionType(row.question_type || row.questionType)
    const key = `${entryKey}|${qtype}`
    const current = best.get(key)
    if (!current || rankLess(cardRank(row, selected), cardRank(current, selected))) best.set(key, row)
  }
  return [...best.values()].sort((a, b) => {
    return (
      String(a.grade || '').localeCompare(String(b.grade || ''), 'zh') ||
      String(a.kind || '').localeCompare(String(b.kind || '')) ||
      String(a.entry_key || a.entryKey || '').localeCompare(String(b.entry_key || b.entryKey || '')) ||
      String(a.question_type || a.questionType || '').localeCompare(String(b.question_type || b.questionType || '')) ||
      String(a.id || '').localeCompare(String(b.id || ''))
    )
  })
}

export function audiencesForGrades(grades: string[] | null | undefined): Set<string> | null {
  const selected = new Set((grades || []).filter(Boolean).map(String))
  if (!selected.size) return null
  const wanted = new Set(['all'])
  const hasLower = [...selected].some(item => LOWER_GRADES.has(item) || MID_GRADES.has(item))
  const hasUpper = [...selected].some(item => UPPER_GRADES.has(item) || MID_GRADES.has(item))
  if (hasLower) wanted.add('lower')
  if (hasUpper) wanted.add('upper')
  return wanted
}

export function mutateLemma(text: unknown): string {
  const source = String(text || '')
  const chars = Array.from(source)
  if (!chars.length) return `${source}甲`
  const index = stableInt(source) % chars.length
  const current = chars[index]
  let replacement = CONFUSABLES[current]
  if (!replacement || replacement === current) {
    replacement = '甲'
    for (const extra of '甲乙丙丁戊己庚辛') {
      if (!source.includes(extra)) {
        replacement = extra
        break
      }
    }
  }
  chars[index] = replacement
  const mutated = chars.join('')
  if (mutated === source) return source.length > 1 ? `${source.slice(0, -1)}甲` : `${source}乙`
  return mutated
}

export function fillEntryFields(point: PointLike): PointLike {
  const qtype = normalizeQuestionType(point.question_type || point.questionType)
  const audience = normalizeAudience(point.audience)
  const key = String(point.key || point.point_key || point.pointKey || '').trim()
  const kind = String(point.kind || '')
  let lemma = lemmaOf({ ...point, question_type: qtype })
  if ((qtype === 'recite' || qtype === 'dictation') && !lemma) lemma = String(point.answer || '').trim()
  const entryKey = String(point.entry_key || point.entryKey || '').trim() || makeEntryKey(kind, lemma, key)
  point.question_type = qtype
  point.audience = audience
  point.lemma = lemma
  point.entry_key = entryKey
  point.options = encodeOptions(point.options)
  if (entryKey) {
    point.group = entryKey
    point.group_key = entryKey
  }
  if (!String(point.sub_group || '').trim()) {
    point.sub_group = qtype
    point.sub_group_key = qtype
  }
  return point
}

export function makeCharJudgeCard(base: PointLike): PointLike {
  const lemma = String(base.lemma || base.answer || '').trim()
  const key = String(base.key || base.point_key || base.pointKey || '').trim()
  const wrong = mutateLemma(lemma)
  const useWrong = stableInt(`${lemma}:judge`) % 2 === 1
  const display = useWrong ? wrong : lemma
  return fillEntryFields({
    ...base,
    key: key ? `${key}:char_judge` : '',
    question_type: 'char_judge',
    audience: 'lower',
    lemma,
    prompt: '下面的写法对不对？',
    answer: useWrong ? '错' : '对',
    options: { display },
    sub_group: 'char_judge'
  })
}

function choicePool(points: PointLike[]): string[] {
  const hints: string[] = []
  const seen = new Set<string>()
  for (const point of points) {
    const hint = meaningHint(point)
    const qtype = normalizeQuestionType(point.question_type || point.questionType)
    if (hint.length < 4 || seen.has(hint) || qtype === 'char_judge' || qtype === 'meaning_choice') continue
    seen.add(hint)
    hints.push(hint)
  }
  return hints
}

export function makeMeaningCard(base: PointLike, pool: string[]): PointLike {
  const lemma = String(base.lemma || base.answer || '').trim()
  const key = String(base.key || base.point_key || base.pointKey || '').trim()
  const correct = meaningHint(base) || '请选择正确的意思'
  const others = pool.filter(item => item !== correct).sort((a, b) => stableInt(lemma + a) - stableInt(lemma + b))
  const distractors = others.slice(0, 3)
  let pad = 0
  while (distractors.length < 3) {
    const extra = GENERIC_HINTS[pad % GENERIC_HINTS.length]
    if (extra !== correct && !distractors.includes(extra)) distractors.push(extra)
    pad += 1
  }
  const choices = [correct, ...distractors].sort((a, b) => stableInt(`${lemma}:choice:${a}`) - stableInt(`${lemma}:choice:${b}`))
  return fillEntryFields({
    ...base,
    key: key ? `${key}:meaning_choice` : '',
    question_type: 'meaning_choice',
    audience: 'upper',
    lemma,
    prompt: `「${lemma}」的意思是？`,
    answer: correct,
    options: { choices },
    sub_group: 'meaning_choice'
  })
}

export function maybeExpandPackCards(points: PointLike[] | null | undefined): PointLike[] {
  const rows = (points || []).filter(item => item && typeof item === 'object').map(item => ({ ...item }))
  if (rows.some(item => ['char_judge', 'meaning_choice'].includes(normalizeQuestionType(item.question_type || item.questionType)))) {
    return rows.map(item => fillEntryFields(item))
  }
  const pool = choicePool(rows)
  const expanded: PointLike[] = []
  for (const item of rows) {
    let point = fillEntryFields({ ...item })
    const kind = String(point.kind || '')
    if (SOLO_KINDS.has(kind) || kind === 'idiom') point.question_type = 'recite'
    point.audience = 'all'
    point = fillEntryFields(point)
    expanded.push(point)
    const lemma = String(point.lemma || '')
    const compact = normalize(lemma)
    if (kind === 'idiom') continue
    if ((kind === 'zi' || kind === 'saying') && compact.length >= 1 && compact.length <= 8) {
      expanded.push(makeCharJudgeCard(point))
    }
    if (kind === 'saying' && looksLikeMeaning(point)) {
      expanded.push(makeMeaningCard(point, pool))
    }
  }
  return expanded
}

export { AUDIENCES, GRADES as GRADE_ORDER, LEVELS as LEVEL_ORDER }
