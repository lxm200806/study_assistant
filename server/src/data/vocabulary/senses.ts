import fs from 'fs'
import path from 'path'

export interface GlobalSense {
  meaning: string
  englishMeaning: string
  phonetic: string
  exampleSentence: string
  exampleSentences?: string[]
}

const SENSES_PATH = path.join(__dirname, '../../../data/sources/senses.json')

let cached: Record<string, GlobalSense> | null = null

export function sensesFilePath(): string {
  return SENSES_PATH
}

function uniqueExamples(...lists: Array<string[] | undefined>): string[] {
  const out: string[] = []
  for (const list of lists) {
    for (const raw of list || []) {
      const example = raw.trim()
      if (example && !out.includes(example)) out.push(example)
    }
  }
  return out
}

export function senseWithExamples(sense: Omit<GlobalSense, 'exampleSentence' | 'exampleSentences'> & {
  exampleSentence?: string
  exampleSentences?: string[]
  examples?: string[]
}): GlobalSense {
  const examples = uniqueExamples(
    sense.exampleSentence ? [sense.exampleSentence] : [],
    sense.exampleSentences,
    sense.examples
  )
  return {
    meaning: sense.meaning,
    englishMeaning: sense.englishMeaning,
    phonetic: sense.phonetic,
    exampleSentence: examples[0] || '',
    ...(examples.length > 1 ? { exampleSentences: examples } : {})
  }
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
  fallback: Partial<GlobalSense> & { examples?: string[] } = {}
): GlobalSense {
  const hit = lookupSense(word)
  return senseWithExamples({
    meaning: hit?.meaning || fallback.meaning || word,
    englishMeaning: hit?.englishMeaning || fallback.englishMeaning || '',
    phonetic: hit?.phonetic || fallback.phonetic || '',
    exampleSentence: hit?.exampleSentence || fallback.exampleSentence || '',
    exampleSentences: hit?.exampleSentence ? hit.exampleSentences : fallback.exampleSentences,
    examples: hit?.exampleSentence ? undefined : fallback.examples
  })
}
