import type { Vocabulary, MeaningType } from '@/types'

export type { MeaningType }

/** 简单词：有 emoji 配图；复杂词：用文字释义 */
export function isVisualWord(word: Pick<Vocabulary, 'image' | 'visual'>): boolean {
  if (word.visual !== undefined) return word.visual
  return !!word.image
}

export function getWordMeaning(
  word: Pick<Vocabulary, 'meaning' | 'englishMeaning'>,
  meaningType: MeaningType
): string {
  if (meaningType === 'english' && word.englishMeaning) {
    return word.englishMeaning
  }
  return word.meaning
}

export function getWordDisplayLabel(
  word: Vocabulary,
  meaningType: MeaningType
): { mode: 'image' | 'text'; content: string } {
  if (isVisualWord(word) && word.image) {
    return { mode: 'image', content: word.image }
  }
  return { mode: 'text', content: getWordMeaning(word, meaningType) }
}

export function getRecognitionHint(word: Vocabulary, meaningType: MeaningType): string {
  if (isVisualWord(word) && word.image) {
    return '选择图片对应的单词'
  }
  return meaningType === 'english' ? '选择释义对应的单词' : '选择中文释义对应的单词'
}
