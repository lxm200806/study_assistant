import fs from 'fs'
import path from 'path'

export interface GlobalSense {
  meaning: string
  englishMeaning: string
  phonetic: string
}

const SENSES_PATH = path.join(__dirname, '../../../data/sources/senses.json')

let cached: Record<string, GlobalSense> | null = null

export function sensesFilePath(): string {
  return SENSES_PATH
}

export function loadGlobalSenses(): Record<string, GlobalSense> {
  if (cached) return cached
  if (!fs.existsSync(SENSES_PATH)) {
    cached = {}
    return cached
  }
  cached = JSON.parse(fs.readFileSync(SENSES_PATH, 'utf-8')) as Record<string, GlobalSense>
  return cached
}

export function lookupSense(word: string): GlobalSense | undefined {
  return loadGlobalSenses()[word.trim().toLowerCase()]
}

export function resolveSense(
  word: string,
  fallback: Partial<GlobalSense>
): GlobalSense {
  const hit = lookupSense(word)
  return {
    meaning: hit?.meaning || fallback.meaning || word,
    englishMeaning: hit?.englishMeaning || fallback.englishMeaning || '',
    phonetic: hit?.phonetic || fallback.phonetic || ''
  }
}
