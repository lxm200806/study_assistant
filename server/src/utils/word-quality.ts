/** 判断 Cambridge PDF 解析产生的无效「伪词条」 */
export function isParseArtifact(word: string): boolean {
  const w = word.trim().toLowerCase()
  if (!w || w.length < 2) return true
  if (/^\d+$/.test(w)) return true
  if (/^\d+\s/.test(w)) return true
  if (/^\d{4}\s/.test(w)) return true
  if (/\d-\d/.test(w)) return true
  if (/\s\d/.test(w) || /\d\s/.test(w)) return true
  if (/\b2025\b/.test(w)) return true
  if (/^[a-z]\s+[a-z]/.test(w)) return true
  if (w.split(/\s+/).length > 5) return true
  if (/^(page|ucles|cup|contents|appendix|introduction)\b/.test(w)) return true
  if (/\(n\)|\(v\)|\(adj\)/.test(w)) return true

  const parts = w.split(/\s+/)
  const badTail = ['page', 'here', 'then', 'below', 'beside', 'still', 'behind', 'hours', 'cup']
  if (parts.length >= 2 && badTail.includes(parts[parts.length - 1]!)) return true
  if (parts.length >= 2 && ['i', 'me', 'my', 'you', 'he', 'she', 'it', 'we', 'they'].includes(parts[parts.length - 1]!)) {
    return true
  }
  if (/^(it|i|we|you|he|she|they|my|your|the|a|an|this|that|what|how|when|where|why|who|don't|doesn't|can't|won't)\s/.test(w)) {
    return true
  }

  if (parts.length >= 3) {
    const looksLikeTopicGrid = parts.every(p => p.length <= 12 && /^[a-z0-9'-]+$/.test(p))
    const hasPosSuffix = /\b(n|v|adj|adv|prep|det|pron|mv)\b/.test(w)
    if (looksLikeTopicGrid && parts.length >= 4 && !hasPosSuffix) return true
  }

  return false
}

export type VocabularyIssueType = 'missing_cn' | 'parse_error'

export function classifyVocabularyIssue(
  word: string,
  meaning: string,
  englishMeaning?: string | null
): VocabularyIssueType | null {
  if (isParseArtifact(word)) return 'parse_error'
  if (!meaning || meaning.trim().length === 0) return 'missing_cn'
  if (meaning.startsWith('[待校对]')) return 'missing_cn'
  if (englishMeaning?.startsWith('[待校对]')) return 'missing_cn'
  return null
}
