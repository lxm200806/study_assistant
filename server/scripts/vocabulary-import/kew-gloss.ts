import fs from 'fs'

export interface KewGloss {
  meaning: string
  englishMeaning: string
  phonetic: string
  exampleSentence: string
  exampleSentences?: string[]
}

/** 义项表键就是单词本身。仍接受旧的 word::sense 写法。 */
export function glossWord(key: string): string {
  return key.split('::')[0].trim().toLowerCase()
}

export function glossKey(word: string, _senseKey = ''): string {
  return glossWord(word)
}

function pushExample(list: string[], value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return
  if (!list.includes(trimmed)) list.push(trimmed)
}

function joinText(current: string, next: string, sep: string): string {
  const extra = next.trim()
  if (!extra) return current
  if (!current) return extra
  if (current === extra || current.split(/[；;]/).map(part => part.trim()).includes(extra)) return current
  return `${current}${sep}${extra}`
}

export function mergeGloss(current: KewGloss, extra: KewGloss): KewGloss {
  const examples: string[] = []
  pushExample(examples, current.exampleSentence)
  for (const item of current.exampleSentences || []) pushExample(examples, item)
  pushExample(examples, extra.exampleSentence)
  for (const item of extra.exampleSentences || []) pushExample(examples, item)
  return {
    meaning: joinText(current.meaning, extra.meaning, '；'),
    englishMeaning: joinText(current.englishMeaning, extra.englishMeaning, '; '),
    phonetic: current.phonetic || extra.phonetic,
    exampleSentence: examples[0] || current.exampleSentence,
    ...(examples.length > 1 ? { exampleSentences: examples } : {})
  }
}

/** 把 word::sense 旧键收成单词键；同一单词多条则合并释义和例句。 */
export function normalizeGlossMap(raw: Record<string, KewGloss>): Record<string, KewGloss> {
  const merged: Record<string, KewGloss> = {}
  for (const [key, gloss] of Object.entries(raw)) {
    const word = glossWord(key)
    if (!word) continue
    merged[word] = merged[word] ? mergeGloss(merged[word], gloss) : gloss
  }
  const out: Record<string, KewGloss> = {}
  for (const word of Object.keys(merged).sort()) out[word] = merged[word]
  return out
}

export function loadNormalizedGlosses(filePath: string): Record<string, KewGloss> {
  if (!fs.existsSync(filePath)) return {}
  return normalizeGlossMap(JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, KewGloss>)
}

export function writeNormalizedGlosses(filePath: string, raw: Record<string, KewGloss>) {
  fs.writeFileSync(filePath, `${JSON.stringify(normalizeGlossMap(raw), null, 2)}\n`)
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}

function isFakePhonetic(word: string, phonetic: string): boolean {
  const inner = phonetic.replace(/^\/|\/$/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  return inner === word.toLowerCase()
}

function looksLikeIpa(phonetic: string): boolean {
  if (!/^\/[^/\n]{1,40}\/$/.test(phonetic)) return false
  return /[ˈˌːɪæɑɒʌəɜɔʊθðʃʒŋ]/.test(phonetic)
}

function exampleContainsWord(word: string, example: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(example)
}

export function validateGloss(word: string, gloss: KewGloss): string[] {
  const errors: string[] = []
  if (!hasChinese(gloss.meaning) || gloss.meaning.includes('[待校对]')) {
    errors.push('汉语解释无效')
  }
  if (gloss.meaning.length > 30) errors.push('汉语解释过长')
  if (hasChinese(gloss.englishMeaning) || gloss.englishMeaning.length < 8) {
    errors.push('英语解释无效')
  }
  if (isFakePhonetic(word, gloss.phonetic) || !looksLikeIpa(gloss.phonetic)) {
    errors.push(`音标无效: ${gloss.phonetic}`)
  }
  if (!exampleContainsWord(word, gloss.exampleSentence)) {
    errors.push('例句未包含目标词')
  }
  const words = gloss.exampleSentence.trim().split(/\s+/)
  if (words.length < 4 || words.length > 16) errors.push('例句长度不合适')
  return errors
}
