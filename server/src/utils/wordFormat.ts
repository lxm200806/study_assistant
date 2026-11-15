import type { Vocabulary } from '../types'
import type { WordExample } from '../data/vocabulary/types'
import { normalizeTopic } from '../data/taxonomy'

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

/** Import placeholders like "Students study the word X in this book." */
export function isPlaceholderExample(text: string, spelling = ''): boolean {
  const t = text.trim()
  if (!t) return true
  if (/^students study the word\b/i.test(t)) return true
  if (spelling && new RegExp(`^we use the word\\s+${escapeRegExp(spelling)}\\b`, 'i').test(t)) {
    return true
  }
  return false
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Prefer real sentences; keep placeholders only if nothing else exists. */
export function bookWordExamples(bv: {
  exampleSentences?: string[] | null
  word: { word?: string; exampleSentence?: string | null }
}): string[] {
  const spelling = bv.word.word || ''
  const fromBook = (bv.exampleSentences || []).map(item => item.trim()).filter(Boolean)
  const fallback = bv.word.exampleSentence?.trim()
  const merged = [...fromBook]
  if (fallback && !merged.includes(fallback)) merged.push(fallback)
  const unique = [...new Set(merged)]
  const real = unique.filter(item => !isPlaceholderExample(item, spelling))
  return real.length ? real : unique
}

function cefrFromTags(tags?: string[]): string | undefined {
  const hit = (tags || []).find(t => t.startsWith('cefr:'))
  return hit ? hit.slice(5) : undefined
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
  exampleItems?: WordExample[]
  contentType?: string | null
  topic?: string | null
  topics?: string[]
  cefr?: string | null
  tags?: string[]
  senseKey?: string | null
  senseLabel?: string | null
}): Vocabulary {
  const image = word.imageUrl || undefined
  const exampleItems = word.exampleItems
  const examples = word.examples?.length
    ? word.examples
    : exampleItems?.length
      ? exampleItems.map(e => e.en).filter(Boolean)
      : word.exampleSentence
        ? [word.exampleSentence]
        : undefined
  const topic = word.topic ? normalizeTopic(word.topic) : undefined
  const topics = (word.topics?.length ? word.topics : topic ? [topic] : undefined)?.map(normalizeTopic)
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
    exampleItems,
    contentType: word.contentType || undefined,
    topic,
    topics,
    cefr: word.cefr || cefrFromTags(word.tags) || undefined,
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
  options?: { seed?: string; rotate?: boolean; exampleItems?: WordExample[]; topics?: string[]; cefr?: string }
) {
  const examples = bookWordExamples(bv)
  const example = options?.rotate && examples.length && options.seed
    ? pickRotatedItem(examples, options.seed)
    : examples[0]
  const exampleItems =
    options?.exampleItems ||
    examples.map((en, index) => ({
      en,
      role: (index === 0 ? 'basic' : 'exam') as WordExample['role'],
      source: index === 0 ? 'book' : 'book'
    }))
  return formatWordForClient({
    ...bv.word,
    meaning: bv.meaning?.trim() || bv.word.meaning,
    englishMeaning: bv.englishMeaning?.trim() || bv.word.englishMeaning,
    example,
    examples,
    exampleItems,
    topics: options?.topics || (bv.word.topic ? [bv.word.topic] : undefined),
    cefr: options?.cefr
  })
}
