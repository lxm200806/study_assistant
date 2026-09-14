/**
 * 所有词书共用的词条字段。和 KEW 成品一致：
 * 中文意思、音标、英文释义、例句 必须都有。
 */
import type { WordData, WordSources } from '../../src/data/vocabulary/types'
import { glossKey, loadNormalizedGlosses, normalizeGlossMap, writeNormalizedGlosses, type KewGloss } from './kew-gloss'

export type BookGloss = KewGloss

const PHRASAL_PREFIX =
  /^(get|go|look|put|take|turn|wake|sit|pick|find|work|write|come|bring|break|check|try|pay|wait|listen|talk|think|give|grow|hang|hand|hold|keep|knock|pass|run|set|show|sign|split|throw|tidy|wash|wear|call|carry|chill|cross|cut|dial|end|feel|fill|wake)\s/i

export function sourceTags(sources: WordSources): string[] {
  return [
    `src:list=${sources.list}`,
    `src:meaning=${sources.meaning}`,
    `src:phonetic=${sources.phonetic}`,
    `src:english=${sources.englishMeaning}`,
    `src:example=${sources.example}`
  ]
}

export function exampleContainsWord(word: string, example: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(example) || example.toLowerCase().includes(word.toLowerCase())
}

export function makeExampleSentence(word: string, pos = ''): string {
  const w = word.trim()
  const p = pos.toLowerCase().replace(/\s+/g, '')
  let example = ''
  if (w === 'a few' || w === 'a little') {
    example = `I have ${w} apples in the bag.`
  } else if (w === 'a lot' || w === 'a bit') {
    example = `She reads ${w} in her free time.`
  } else if (w.includes(' ')) {
    example = PHRASAL_PREFIX.test(w) || p.includes('phr')
      ? `They ${w} after class.`
      : `We talked about ${w} at school.`
  } else if (p.includes('phr')) {
    example = `Please ${w} before you leave.`
  } else if ((p.startsWith('v') || p.includes('v.')) && !p.startsWith('vowel') && !p.includes('adv')) {
    example = `They ${w} the idea in the meeting.`
  } else if (p.includes('adj')) {
    example = `It was a ${w} example in class.`
  } else if (p.includes('adv')) {
    example = `She answered ${w} during the interview.`
  } else if (p.includes('prep')) {
    example = `Put the keys ${w} the table.`
  } else if (p.includes('conj')) {
    example = `Wait here ${w} I come back.`
  } else if (p.includes('pron')) {
    example = `${w} is waiting by the door.`
  } else if (p.includes('det')) {
    example = `I have ${w} books on the desk.`
  } else {
    example = `Students study the word ${w} in this book.`
  }
  if (!exampleContainsWord(w, example)) {
    example = `Students study the word ${w} in this book.`
  }
  return example
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}

function isPending(text: string | undefined): boolean {
  return !text || !text.trim() || text.includes('[待校对]')
}

function isFakePhonetic(word: string, phonetic: string): boolean {
  const inner = phonetic.replace(/^\/|\/$/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  return !inner || inner === word.toLowerCase()
}

function isGeneratedExample(word: string, example: string): boolean {
  const w = word.trim()
  return (
    example === makeExampleSentence(w) ||
    example.startsWith('Students study the word ') ||
    example.startsWith('We talked about ') ||
    /^They .+ after class\.$/.test(example)
  )
}

export function inferFieldSource(
  word: string,
  kind: 'meaning' | 'englishMeaning' | 'phonetic' | 'example',
  value: string,
  fallback: string
): string {
  if (kind === 'example') {
    return isGeneratedExample(word, value) ? 'generated' : fallback
  }
  if (kind === 'meaning' && (isPending(value) || !hasChinese(value))) return 'pending'
  if (
    kind === 'englishMeaning' &&
    (isPending(value) || hasChinese(value) || value.length < 8 || value.startsWith('a listed target word:'))
  ) {
    return 'pending'
  }
  if (kind === 'phonetic' && isFakePhonetic(word, value)) return 'pending'
  return fallback
}

export function completeWordData(
  input: Partial<WordData> & { word: string },
  listSource: string,
  dictSource = 'ecdict'
): WordData {
  const word = input.word
  const meaning = input.meaning?.trim() || `[待校对] ${word}`
  let englishMeaning = (input.englishMeaning || '').trim()
  if (isPending(englishMeaning) || hasChinese(englishMeaning)) {
    englishMeaning = isPending(englishMeaning) ? `a listed target word: ${word}` : englishMeaning
    if (hasChinese(englishMeaning) || englishMeaning.length < 8) {
      englishMeaning = `a listed target word: ${word}`
    }
  }
  let phonetic = (input.phonetic || '').trim()
  if (!phonetic) phonetic = `/${word}/`
  if (!phonetic.startsWith('/')) phonetic = `/${phonetic.replace(/^\/|\/$/g, '')}/`

  const currentExample = input.exampleSentence?.trim() || ''
  const exampleSentence =
    !currentExample || isGeneratedExample(word, currentExample)
      ? makeExampleSentence(word)
      : currentExample
  const sources: WordSources = {
    list: listSource,
    meaning: inferFieldSource(word, 'meaning', meaning, input.sources?.meaning || dictSource),
    phonetic: inferFieldSource(word, 'phonetic', phonetic, input.sources?.phonetic || dictSource),
    englishMeaning: inferFieldSource(
      word,
      'englishMeaning',
      englishMeaning,
      input.sources?.englishMeaning || dictSource
    ),
    example: inferFieldSource(word, 'example', exampleSentence, input.sources?.example || dictSource)
  }
  const tags = (input.tags || []).filter(tag => !tag.startsWith('src:'))
  return {
    ...input,
    word,
    meaning,
    phonetic,
    englishMeaning,
    exampleSentence,
    senseKey: input.senseKey || '',
    senseLabel: input.senseLabel || '',
    sources,
    tags: [...new Set([...tags, ...sourceTags(sources)])]
  }
}

export function wordToGloss(item: WordData): BookGloss {
  return {
    meaning: item.meaning,
    englishMeaning: item.englishMeaning || `a listed target word: ${item.word}`,
    phonetic: item.phonetic,
    exampleSentence: item.exampleSentence || makeExampleSentence(item.word)
  }
}

export function writeGlossFile(filePath: string, words: WordData[]): void {
  const map: Record<string, BookGloss> = {}
  for (const item of words) {
    map[glossKey(item.word)] = wordToGloss(item)
  }
  writeNormalizedGlosses(filePath, map)
}

export function upsertGlossFile(filePath: string, words: WordData[]): number {
  const existing = loadNormalizedGlosses(filePath)
  let added = 0
  for (const item of words) {
    const key = glossKey(item.word)
    if (existing[key]) continue
    existing[key] = wordToGloss(item)
    added += 1
  }
  writeNormalizedGlosses(filePath, existing)
  return added
}

export function applyGlosses(
  words: WordData[],
  glosses: Record<string, BookGloss>,
  listSource: string,
  dictSource = 'ecdict'
): WordData[] {
  const normalized = normalizeGlossMap(glosses)
  return words.map(item => {
    const key = glossKey(item.word)
    const gloss = normalized[key]
    if (!gloss) return completeWordData(item, listSource, dictSource)
    return completeWordData(
      {
        ...item,
        meaning: gloss.meaning,
        englishMeaning: gloss.englishMeaning,
        phonetic: gloss.phonetic,
        exampleSentence: gloss.exampleSentence,
        exampleSentences: gloss.exampleSentences,
        sources: undefined
      },
      listSource,
      dictSource
    )
  })
}
