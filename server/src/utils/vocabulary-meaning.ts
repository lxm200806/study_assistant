import { isParseArtifact, classifyVocabularyIssue, type VocabularyIssueType } from './word-quality'

export function isMissingMeaning(meaning: string, englishMeaning?: string | null): boolean {
  if (!meaning || meaning.trim().length === 0) return true
  if (meaning.startsWith('[待校对]')) return true
  if (englishMeaning?.startsWith('[待校对]')) return true
  return false
}

export { isParseArtifact, classifyVocabularyIssue, type VocabularyIssueType }
