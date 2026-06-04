import fs from 'fs'
import path from 'path'
import type { KyleBingEntry } from './parse-kylebing'
import {
  lookupCnFromMap,
  fetchEnglishDefinition,
  resolveMissingMeaning
} from './meaning-lookup'

const CACHE_PATH = path.join(__dirname, '../../data/sources/en-dict-cache.json')

export interface EnrichedWord {
  word: string
  meaning: string
  phonetic: string
  englishMeaning: string
  emoji?: string
}

let cache: Record<string, { phonetic?: string; definition?: string; failed?: boolean }> = {}

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
  const fromCn = lookupCnFromMap(key, lookup)

  let meaning = fromCn?.meaning || ''
  let phonetic = fromCn?.phonetic || ''
  let englishMeaning = fromCn?.englishMeaning || ''

  const cached = cache[key]
  if (cached?.phonetic) phonetic = cached.phonetic
  if (cached?.definition) englishMeaning = cached.definition

  if (useApi && (!meaning || !englishMeaning || phonetic === `/${key}/` || phonetic === '')) {
    const resolved = await resolveMissingMeaning(key, lookup, cache, {
      useTranslate: true,
      useLlm: !!process.env.OPENAI_API_KEY || !!process.env.DEEPSEEK_API_KEY
    })
    if (resolved) {
      if (resolved.meaning && !resolved.meaning.startsWith('[待校对]')) meaning = resolved.meaning
      if (resolved.englishMeaning) englishMeaning = resolved.englishMeaning
      if (resolved.phonetic) phonetic = resolved.phonetic
    } else {
      await fetchEnglishDefinition(key, cache)
      const after = cache[key]
      if (after?.definition && !englishMeaning) englishMeaning = after.definition
      if (after?.phonetic && !phonetic) phonetic = after.phonetic
    }
  }

  if (!meaning) {
    meaning = `[待校对] ${key}`
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
