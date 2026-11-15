import type { WordData } from './types'

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

/** 同一本书里相同拼写合并为一行，多条例句保留下来轮换。 */
export function collectBookWordEntries(words: WordData[]): BookWordEntry[] {
  const map = new Map<string, BookWordEntry>()

  for (let i = 0; i < words.length; i++) {
    const item = words[i]
    const word = item.word.trim().toLowerCase()
    if (!word) continue

    const existing = map.get(word)
    if (!existing) {
      map.set(word, {
        word,
        meaning: item.meaning,
        phonetic: item.phonetic,
        englishMeaning: item.englishMeaning,
        examples: collectExampleStrings(item),
        emoji: item.emoji,
        contentType: item.contentType,
        topic: item.topics?.[0] || item.topic,
        tags: mergeTags(item),
        sortOrder: i
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
  }

  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder)
}
