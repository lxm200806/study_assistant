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

/** 同一本书里相同拼写合并为一行，多条例句保留下来轮换。 */
export function collectBookWordEntries(words: WordData[]): BookWordEntry[] {
  const map = new Map<string, BookWordEntry>()

  for (let i = 0; i < words.length; i++) {
    const item = words[i]
    const word = item.word.trim().toLowerCase()
    if (!word) continue

    const existing = map.get(word)
    if (!existing) {
      const examples: string[] = []
      pushUnique(examples, item.exampleSentence)
      for (const extra of item.exampleSentences || []) pushUnique(examples, extra)
      map.set(word, {
        word,
        meaning: item.meaning,
        phonetic: item.phonetic,
        englishMeaning: item.englishMeaning,
        examples,
        emoji: item.emoji,
        contentType: item.contentType,
        topic: item.topic,
        tags: [...(item.tags || [])],
        sortOrder: i
      })
      continue
    }

    pushUnique(existing.examples, item.exampleSentence)
    for (const extra of item.exampleSentences || []) pushUnique(existing.examples, extra)
    existing.meaning = joinUnique(existing.meaning, item.meaning)
    existing.englishMeaning = joinUnique(existing.englishMeaning, item.englishMeaning, '; ')
    existing.tags = [...new Set([...existing.tags, ...(item.tags || [])])]
  }

  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder)
}
