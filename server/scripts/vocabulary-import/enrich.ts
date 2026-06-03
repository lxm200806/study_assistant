import fs from 'fs'
import path from 'path'
import type { KyleBingEntry } from './parse-kylebing'

const CACHE_PATH = path.join(__dirname, '../../data/sources/en-dict-cache.json')

export interface EnrichedWord {
  word: string
  meaning: string
  phonetic: string
  englishMeaning: string
  emoji?: string
}

let cache: Record<string, { phonetic?: string; definition?: string }> = {}

export function loadEnCache() {
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'))
  }
}

export function saveEnCache() {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
}

export async function enrichWord(
  word: string,
  lookup: Map<string, KyleBingEntry>,
  emojiMap: Record<string, string>,
  useApi: boolean
): Promise<EnrichedWord | null> {
  const key = word.toLowerCase()
  const fromCn = lookup.get(key)

  let meaning = fromCn?.meaning || ''
  let phonetic = fromCn?.phonetic || ''
  let englishMeaning = fromCn?.englishMeaning || ''

  const cached = cache[key]
  if (cached?.phonetic) phonetic = cached.phonetic
  if (cached?.definition) englishMeaning = cached.definition

  if (useApi && (!meaning || !englishMeaning || phonetic === `/${key}/` || phonetic === '')) {
    await fetchDictionary(key)
    const after = cache[key]
    if (after?.definition && !englishMeaning) englishMeaning = after.definition
    if (after?.phonetic && !phonetic) phonetic = after.phonetic
  }

  if (!meaning) {
    return null
  }

  if (!englishMeaning) {
    englishMeaning = meaning
  }

  if (!phonetic) {
    phonetic = `/${key}/`
  }

  const emoji = emojiMap[key]
  const result: EnrichedWord = {
    word: key,
    meaning: sanitizeMeaning(meaning),
    phonetic: sanitizePhonetic(phonetic),
    englishMeaning: sanitizeEnglish(englishMeaning)
  }

  if (emoji) {
    result.emoji = emoji
  }

  return result
}

function sanitizeMeaning(m: string): string {
  return m.replace(/\s+/g, ' ').trim()
}

function sanitizePhonetic(p: string): string {
  p = p.trim()
  if (!p.startsWith('/')) p = `/${p.replace(/^\/|\/$/g, '')}/`
  return p
}

function sanitizeEnglish(e: string): string {
  return e.replace(/\s+/g, ' ').trim().slice(0, 200)
}

async function fetchDictionary(word: string): Promise<void> {
  if (cache[word]) return

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
    if (!res.ok) {
      cache[word] = {}
      return
    }
    const data = await res.json() as Array<{
      phonetic?: string
      phonetics?: Array<{ text?: string }>
      meanings?: Array<{ definitions?: Array<{ definition?: string }> }>
    }>

    const entry = data[0]
    const phonetic = entry?.phonetic || entry?.phonetics?.find(p => p.text)?.text || ''
    const definition = entry?.meanings?.[0]?.definitions?.[0]?.definition || ''

    cache[word] = { phonetic, definition }
  } catch {
    cache[word] = {}
  }

  // 限速
  await sleep(120)
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
