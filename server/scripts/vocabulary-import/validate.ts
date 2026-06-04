import type { EnrichedWord } from './enrich'
import { isParseArtifact } from '../../src/utils/word-quality'

export interface ValidationIssue {
  word: string
  reason: string
}

export function isMissingMeaning(meaning: string, englishMeaning?: string | null): boolean {
  if (!meaning || meaning.trim().length === 0) return true
  if (meaning.startsWith('[待校对]')) return true
  if (englishMeaning?.startsWith('[待校对]')) return true
  return false
}

export function validateBookWords(words: EnrichedWord[]): {
  valid: EnrichedWord[]
  issues: ValidationIssue[]
} {
  const issues: ValidationIssue[] = []
  const seen = new Set<string>()
  const draft: EnrichedWord[] = []

  for (const w of words) {
    const key = w.word.toLowerCase()

    if (isParseArtifact(key)) {
      issues.push({ word: key, reason: 'PDF 解析错误（非有效词条）' })
      continue
    }

    if (seen.has(key)) {
      issues.push({ word: key, reason: '重复词条' })
      continue
    }
    seen.add(key)

    if (!w.meaning || w.meaning.length < 1) {
      issues.push({ word: key, reason: '缺少中文释义' })
      continue
    }

    if (!w.englishMeaning || w.englishMeaning.length < 2) {
      issues.push({ word: key, reason: '缺少英文释义' })
      continue
    }

    if (w.meaning.startsWith('[待校对]')) {
      issues.push({ word: key, reason: '中文释义待校对' })
    }

    draft.push(w)
  }

  const valid = disambiguateDuplicateMeanings(draft, issues)
  return { valid, issues }
}

/** 同一本书内 primary meaning 重复时加英文词标注，避免选择题多个正确答案 */
function disambiguateDuplicateMeanings(
  words: EnrichedWord[],
  issues: ValidationIssue[]
): EnrichedWord[] {
  const groups = new Map<string, EnrichedWord[]>()

  for (const w of words) {
    const norm = normalizeForCompare(w.meaning)
    if (!groups.has(norm)) groups.set(norm, [])
    groups.get(norm)!.push(w)
  }

  return words.map(w => {
    const norm = normalizeForCompare(w.meaning)
    const group = groups.get(norm)!
    if (group.length <= 1) return w

    issues.push({
      word: w.word,
      reason: `释义与 ${group.filter(x => x.word !== w.word).map(x => x.word).join(', ')} 重复，已加词形标注`
    })

    if (w.meaning.includes(`（${w.word}）`)) return w
    return { ...w, meaning: `${w.meaning}（${w.word}）` }
  })
}

function normalizeForCompare(m: string): string {
  return m.replace(/\[待校对\]\s*/g, '').split(/[；;，,]/)[0].trim().toLowerCase()
}
