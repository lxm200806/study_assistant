import type { WordData } from './types'
import { asFlatSense, lookupSense, resolveSense, type GlobalSense } from './senses'

export interface BookWordEntry {
  word: string
  meaning: string
  phonetic: string
  englishMeaning: string
  examples: string[]
  emoji?: string
  contentType?: WordData['contentType']
  topic?: WordData['topic']
  tags: string[]
  sortOrder: number
  senseKey?: string
  senseLabel?: string
}

function pushUnique(list: string[], value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return
  if (!list.includes(trimmed)) list.push(trimmed)
}

function joinUnique(current: string, next?: string, sep = '；'): string {
  const extra = next?.trim()
  if (!extra) return current
  if (!current) return extra
  if (current === extra || current.split(/[；;]/).map(part => part.trim()).includes(extra)) return current
  return `${current}${sep}${extra}`
}

function collectExampleStrings(item: WordData): string[] {
  const examples: string[] = []
  const structured = item.examples || []
  const basic = structured.filter(e => e.role === 'basic')
  const rest = structured.filter(e => e.role !== 'basic')
  for (const e of [...basic, ...rest]) pushUnique(examples, e.en)
  pushUnique(examples, item.exampleSentence)
  for (const extra of item.exampleSentences || []) pushUnique(examples, extra)
  return examples
}

function mergeTags(item: WordData, base: string[] = []): string[] {
  const tags = [...base, ...(item.tags || [])]
  if (item.cefr) tags.push(`cefr:${item.cefr}`)
  return [...new Set(tags)]
}

function normalizeSenseToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
}

/** 按书里的 senseKey / senseLabel 选总表义项，再摊平 */
export function flatSenseForBookWord(item: WordData) {
  const word = item.word.trim().toLowerCase()
  const entry = lookupSense(word)
  if (!entry) {
    return resolveSense(word, {
      meaning: item.meaning,
      englishMeaning: item.englishMeaning,
      phonetic: item.phonetic,
      exampleSentence: item.exampleSentence,
      topic: item.topic,
      cefr: item.cefr,
      contentType: item.contentType
    })
  }

  const keyed = pickMeaningIndex(entry, item)
  if (keyed <= 0) return asFlatSense(entry)

  const reordered: GlobalSense = {
    ...entry,
    meanings: [entry.meanings[keyed], ...entry.meanings.filter((_, i) => i !== keyed)]
  }
  return asFlatSense(reordered)
}

function pickMeaningIndex(entry: GlobalSense, item: WordData): number {
  const key = item.senseKey?.trim()
  const label = item.senseLabel?.trim()
  if (!key && !label) return 0
  const keyNorm = key ? normalizeSenseToken(key) : ''
  const labelNorm = label ? normalizeSenseToken(label) : ''

  let best = -1
  for (let i = 0; i < entry.meanings.length; i++) {
    const m = entry.meanings[i]
    const posNorm = m.pos ? normalizeSenseToken(m.pos) : ''
    const zhNorm = m.meaning?.zh ? normalizeSenseToken(m.meaning.zh) : ''
    if (keyNorm && posNorm && (posNorm === keyNorm || posNorm.includes(keyNorm) || keyNorm.includes(posNorm))) {
      return i
    }
    if (labelNorm && zhNorm && (zhNorm === labelNorm || zhNorm.includes(labelNorm))) {
      best = i
    }
  }
  return best >= 0 ? best : 0
}

/** 用总表补齐瘦身词条；书内非空字段仍可作兜底 */
export function hydrateBookWord(item: WordData): WordData {
  const flat = flatSenseForBookWord(item)
  const examples = collectExampleStrings(item)
  if (flat.exampleSentence) pushUnique(examples, flat.exampleSentence)
  if (flat.examExample) pushUnique(examples, flat.examExample)

  const structured = [...(item.examples || [])]
  if (flat.exampleSentence && !structured.some(e => e.role === 'basic' && e.en.trim())) {
    structured.unshift({
      en: flat.exampleSentence,
      role: 'basic',
      ...(flat.exampleSentenceZh ? { zh: flat.exampleSentenceZh } : {})
    })
  }
  if (flat.examExample && !structured.some(e => (e.role === 'exam' || e.role === 'sense') && e.en.trim())) {
    structured.push({
      en: flat.examExample,
      role: 'exam',
      ...(flat.examExampleZh ? { zh: flat.examExampleZh } : {})
    })
  }

  return {
    ...item,
    word: item.word.trim().toLowerCase(),
    meaning: item.meaning?.trim() || flat.meaning || item.word,
    phonetic: item.phonetic?.trim() || flat.phonetic || '',
    englishMeaning: item.englishMeaning?.trim() || flat.englishMeaning || '',
    exampleSentence: item.exampleSentence?.trim() || flat.exampleSentence || examples[0] || '',
    exampleSentences: examples.length > 1 ? examples.slice(1) : item.exampleSentences,
    examples: structured.length ? structured : item.examples,
    topic: item.topic || (flat.topic as WordData['topic']) || item.topics?.[0],
    topics: item.topics?.length
      ? item.topics
      : flat.topic
        ? ([flat.topic] as WordData['topics'])
        : undefined,
    cefr: item.cefr || (flat.cefr as WordData['cefr']),
    contentType: item.contentType || (flat.contentType as WordData['contentType'])
  }
}

/** 同一本书里相同拼写合并为一行，多条例句保留下来轮换。 */
export function collectBookWordEntries(words: WordData[]): BookWordEntry[] {
  const map = new Map<string, BookWordEntry>()

  for (let i = 0; i < words.length; i++) {
    const item = hydrateBookWord(words[i])
    const word = item.word.trim().toLowerCase()
    if (!word) continue

    const existing = map.get(word)
    if (!existing) {
      map.set(word, {
        word,
        meaning: item.meaning || word,
        phonetic: item.phonetic || '',
        englishMeaning: item.englishMeaning || '',
        examples: collectExampleStrings(item),
        emoji: item.emoji,
        contentType: item.contentType,
        topic: item.topics?.[0] || item.topic,
        tags: mergeTags(item),
        sortOrder: i,
        senseKey: item.senseKey,
        senseLabel: item.senseLabel
      })
      continue
    }

    for (const ex of collectExampleStrings(item)) pushUnique(existing.examples, ex)
    existing.meaning = joinUnique(existing.meaning, item.meaning)
    existing.englishMeaning = joinUnique(existing.englishMeaning, item.englishMeaning, '; ')
    existing.tags = mergeTags(item, existing.tags)
    if (!existing.topic && (item.topics?.[0] || item.topic)) {
      existing.topic = item.topics?.[0] || item.topic
    }
    if (!existing.senseKey && item.senseKey) existing.senseKey = item.senseKey
    if (!existing.senseLabel && item.senseLabel) existing.senseLabel = item.senseLabel
  }

  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder)
}
