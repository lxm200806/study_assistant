export const KINDS = ['poem', 'wenyan', 'idiom', 'saying', 'sentence', 'zi'] as const
export type ChineseKind = (typeof KINDS)[number]

export const KIND_LABEL: Record<ChineseKind, string> = {
  poem: '古诗',
  wenyan: '文言文',
  idiom: '词语',
  saying: '俗语名句',
  sentence: '优美句子',
  zi: '易错字'
}

export const LEVELS = ['L1', 'L2', 'L3', 'L4'] as const
export type ChineseLevel = (typeof LEVELS)[number]

export const GRADES = [
  '一年级上',
  '一年级下',
  '二年级上',
  '二年级下',
  '三年级上',
  '三年级下',
  '四年级上',
  '四年级下',
  '五年级上',
  '五年级下',
  '六年级上',
  '六年级下'
] as const
export type ChineseGrade = (typeof GRADES)[number]

export const QUESTION_TYPES = ['dictation', 'recite', 'char_judge', 'meaning_choice'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  dictation: '默写',
  recite: '背诵',
  char_judge: '字对错',
  meaning_choice: '理解意思'
}

export const AUDIENCES = ['all', 'lower', 'upper'] as const
export type Audience = (typeof AUDIENCES)[number]

export const AUDIENCE_LABEL: Record<Audience, string> = {
  all: '全年级',
  lower: '低年级',
  upper: '高年级'
}

export const LOWER_GRADES = new Set(['一年级上', '一年级下', '二年级上', '二年级下'])
export const UPPER_GRADES = new Set(['四年级上', '四年级下', '五年级上', '五年级下', '六年级上', '六年级下'])
export const MID_GRADES = new Set(['三年级上', '三年级下'])

export const SOLO_KINDS = new Set<string>(['poem', 'wenyan'])
export const DEFAULT_NEW_ENERGY = 30
export const DEFAULT_REVIEW_ENERGY = 30
export const ENERGY_MIN = 8
export const ENERGY_MAX = 120
export const PAGE_DEFAULT = 200
export const PAGE_MAX = 500
export const PLAN_QUALITY = 5
export const PLAN_MAX_DAYS = 240
export const DEFAULT_COURSE_NAME = '默认课程'

export interface PointLike {
  id?: string | number
  key?: string
  point_key?: string
  pointKey?: string
  kind?: string
  level?: string
  grade?: string
  prompt?: string
  answer?: string
  tags?: string
  source?: string
  group?: string
  sub_group?: string
  group_key?: string
  groupKey?: string
  sub_group_key?: string
  subGroupKey?: string
  entry_key?: string
  entryKey?: string
  lemma?: string
  question_type?: string
  questionType?: string
  audience?: string
  options?: unknown
  energy?: number
  last?: string | Date | null
  due?: string | Date | null
  n?: number | null
  ef?: number | null
  interval?: number | null
  lapses?: number | null
  [key: string]: unknown
}

export function isKind(value: string): value is ChineseKind {
  return (KINDS as readonly string[]).includes(value)
}

export function isLevel(value: string): value is ChineseLevel {
  return (LEVELS as readonly string[]).includes(value)
}

export function isGrade(value: string): value is ChineseGrade {
  return (GRADES as readonly string[]).includes(value)
}

export function normalizeQuestionType(value: unknown): QuestionType {
  const text = String(value || '').trim()
  return (QUESTION_TYPES as readonly string[]).includes(text) ? (text as QuestionType) : 'dictation'
}

export function normalizeAudience(value: unknown): Audience {
  const text = String(value || '').trim()
  return (AUDIENCES as readonly string[]).includes(text) ? (text as Audience) : 'all'
}
