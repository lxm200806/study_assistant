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

export function pickRotatedItem<T>(items: T[], seed: string): T {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return items[Math.abs(hash) % items.length]
}

export function bookWordExamples(bv: {
  exampleSentences?: string[] | null
  word: { exampleSentence?: string | null }
}): string[] {
  const fromBook = (bv.exampleSentences || []).map(item => item.trim()).filter(Boolean)
  if (fromBook.length) return [...new Set(fromBook)]
  const fallback = bv.word.exampleSentence?.trim()
  return fallback ? [fallback] : []
}

export function formatWordForClient(word: {
  id: string
  word: string
  meaning: string
  phonetic?: string | null
  englishMeaning?: string | null
  imageUrl?: string | null
  exampleSentence?: string | null
  example?: string
  examples?: string[]
  contentType?: string | null
  topic?: string | null
  tags?: string[]
  senseKey?: string | null
  senseLabel?: string | null
}): Vocabulary & { contentType?: string; topic?: string; tags?: string[]; senseKey?: string; senseLabel?: string; examples?: string[] } {
  const image = word.imageUrl || undefined
  const examples = word.examples?.length
    ? word.examples
    : word.exampleSentence
      ? [word.exampleSentence]
      : undefined
  return {
    id: word.id,
    word: word.word,
    meaning: word.meaning,
    phonetic: word.phonetic || '',
    englishMeaning: word.englishMeaning || undefined,
    image,
    visual: !!image,
    example: word.example || word.exampleSentence || examples?.[0] || undefined,
    examples,
    contentType: word.contentType || undefined,
    topic: word.topic || undefined,
    tags: word.tags || [],
    senseKey: word.senseKey || undefined,
    senseLabel: word.senseLabel || undefined
  }
}

export function formatBookWord(
  bv: {
    meaning?: string | null
    englishMeaning?: string | null
    exampleSentences?: string[] | null
    word: {
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
      senseKey?: string | null
      senseLabel?: string | null
    }
  },
  options?: { seed?: string; rotate?: boolean }
) {
  const examples = bookWordExamples(bv)
  const example = options?.rotate && examples.length && options.seed
    ? pickRotatedItem(examples, options.seed)
    : examples[0]
  return formatWordForClient({
    ...bv.word,
    meaning: bv.meaning?.trim() || bv.word.meaning,
    englishMeaning: bv.englishMeaning?.trim() || bv.word.englishMeaning,
    example,
    examples
  })
}
