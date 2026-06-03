import type { Vocabulary } from '../types'

export type MeaningType = 'chinese' | 'english'

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

export function formatWordForClient(word: {
  id: string
  word: string
  meaning: string
  phonetic?: string | null
  englishMeaning?: string | null
  imageUrl?: string | null
  exampleSentence?: string | null
  contentType?: string | null
  topic?: string | null
  tags?: string[]
}): Vocabulary & { contentType?: string; topic?: string; tags?: string[] } {
  const image = word.imageUrl || undefined
  return {
    id: word.id,
    word: word.word,
    meaning: word.meaning,
    phonetic: word.phonetic || '',
    englishMeaning: word.englishMeaning || undefined,
    image,
    visual: !!image,
    example: word.exampleSentence || undefined,
    contentType: word.contentType || undefined,
    topic: word.topic || undefined,
    tags: word.tags || []
  }
}
