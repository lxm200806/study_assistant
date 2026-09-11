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

/** 选择题选项：同形词带上短义项，避免两个 fly 无法区分 */
export function getWordHeadword(
  word: Pick<Vocabulary, 'word' | 'senseLabel'>
): string {
  if (word.senseLabel) return `${word.word}（${word.senseLabel}）`
  return word.word
}

export function buildWordChoices(
  current: Vocabulary,
  pool: Vocabulary[],
  count: number = 4
): Array<{ id: string; label: string }> {
  const others = pool.filter(w => w.id !== current.id)
  const shuffled = [...others].sort(() => Math.random() - 0.5)
  const picked = [current, ...shuffled.slice(0, Math.max(0, count - 1))]
  return picked
    .map(item => ({ id: item.id, label: getWordHeadword(item) }))
    .sort(() => Math.random() - 0.5)
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
