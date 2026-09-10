import { normalizeQuestionType, type PointLike } from './constants'

const PUNCT = /[\s，。！？、；：,.!?;:'"“”‘’《》【】（）()[\]—…·]/g

export interface GradeResult {
  quality: number
  ratio: number
  correct: boolean
  chars: Array<{ char: string; ok: boolean }>
}

export function normalize(text: unknown): string {
  if (text == null) return ''
  return String(text).replace(PUNCT, '')
}

export function levenshtein(left: unknown, right: unknown): number {
  const a = left == null ? '' : String(left)
  const b = right == null ? '' : String(right)
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr.push(Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost))
    }
    prev = curr
  }
  return prev[b.length]
}

export function diffChars(typed: string, expected: string): Array<{ char: string; ok: boolean }> {
  const answer = normalize(expected)
  const compact = normalize(typed)
  return Array.from(answer).map((ch, i) => ({ char: ch, ok: compact[i] === ch }))
}

export function gradeAnswer(userInput: unknown, expected: unknown): GradeResult {
  const typed = normalize(userInput)
  const answer = normalize(expected)
  if (!answer) return { quality: 1, ratio: 0, correct: false, chars: [] }
  if (!typed) return { quality: 1, ratio: 0, correct: false, chars: diffChars('', answer) }
  if (typed === answer) return { quality: 5, ratio: 1, correct: true, chars: diffChars(typed, answer) }
  const distance = levenshtein(typed, answer)
  const ratio = 1 - distance / Math.max(typed.length, answer.length)
  const safeRatio = Math.max(0, Math.round(ratio * 100) / 100)
  let quality = 1
  if (safeRatio >= 0.95) quality = 5
  else if (safeRatio >= 0.8) quality = 3
  return {
    quality,
    ratio: safeRatio,
    correct: quality === 5,
    chars: diffChars(typed, answer)
  }
}

export function normalizeJudge(value: unknown): string {
  const text = normalize(value)
  const aliases: Record<string, string> = {
    对: '对',
    正确: '对',
    true: '对',
    '1': '对',
    yes: '对',
    错: '错',
    错误: '错',
    false: '错',
    '0': '错',
    no: '错'
  }
  return aliases[text.toLowerCase()] || text
}

export function gradeCharJudge(userInput: unknown, expected: unknown): GradeResult {
  const typed = normalizeJudge(userInput)
  const answer = normalizeJudge(expected)
  const correct = Boolean(typed) && typed === answer
  return { quality: correct ? 5 : 1, ratio: correct ? 1 : 0, correct, chars: [] }
}

export function gradeChoice(userInput: unknown, expected: unknown): GradeResult {
  const typed = normalize(userInput)
  const answer = normalize(expected)
  if (!answer) return { quality: 1, ratio: 0, correct: false, chars: [] }
  const correct = Boolean(typed) && typed === answer
  return { quality: correct ? 5 : 1, ratio: correct ? 1 : 0, correct, chars: [] }
}

export function gradeCard(point: PointLike | null | undefined, userInput: unknown, reveal = false): GradeResult {
  const qtype = normalizeQuestionType(point?.question_type || point?.questionType)
  const expected = point?.answer || ''
  if (reveal) {
    if (qtype === 'char_judge' || qtype === 'usage_judge') return gradeCharJudge('', expected)
    if (['pinyin_choice', 'spelling_choice', 'meaning_choice', 'context_choice'].includes(qtype)) return gradeChoice('', expected)
    return gradeAnswer('', expected)
  }
  if (qtype === 'char_judge' || qtype === 'usage_judge') return gradeCharJudge(userInput, expected)
  if (['pinyin_choice', 'spelling_choice', 'meaning_choice', 'context_choice'].includes(qtype)) {
    return gradeChoice(userInput, expected)
  }
  return gradeAnswer(userInput, expected)
}
