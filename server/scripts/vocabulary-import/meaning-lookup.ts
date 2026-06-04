import type { KyleBingEntry } from './parse-kylebing'

export interface LookupResult {
  meaning: string
  englishMeaning: string
  phonetic: string
  source: string
}

export function wordLookupVariants(word: string): string[] {
  const w = word.toLowerCase().trim()
  const variants = new Set<string>([w])
  variants.add(w.replace(/-/g, ' '))
  variants.add(w.replace(/\s+/g, '-'))
  variants.add(w.replace(/-/g, ''))
  return [...variants].filter(Boolean)
}

export function lookupCnFromMap(word: string, lookup: Map<string, KyleBingEntry>): KyleBingEntry | null {
  for (const variant of wordLookupVariants(word)) {
    const hit = lookup.get(variant)
    if (hit?.meaning) return hit
  }
  return null
}

export async function fetchEnglishDefinition(
  word: string,
  cache: Record<string, { phonetic?: string; definition?: string; failed?: boolean }>
): Promise<{ phonetic: string; definition: string } | null> {
  for (const variant of wordLookupVariants(word)) {
    if (cache[variant]?.definition) {
      return {
        phonetic: cache[variant].phonetic || '',
        definition: cache[variant].definition || ''
      }
    }
    if (cache[variant]?.failed) continue

    const fetched = await requestDictionary(variant)
    cache[variant] = fetched || { failed: true }
    if (fetched?.definition) {
      return fetched
    }
    await sleep(120)
  }
  return null
}

async function requestDictionary(word: string): Promise<{ phonetic: string; definition: string } | null> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    )
    if (!res.ok) return null

    const data = (await res.json()) as Array<{
      phonetic?: string
      phonetics?: Array<{ text?: string }>
      meanings?: Array<{ definitions?: Array<{ definition?: string }> }>
    }>

    const entry = data[0]
    const phonetic = entry?.phonetic || entry?.phonetics?.find(p => p.text)?.text || ''
    const definition = entry?.meanings?.[0]?.definitions?.[0]?.definition || ''
    if (!definition) return null
    return { phonetic, definition }
  } catch {
    return null
  }
}

export async function translateEnToZh(text: string): Promise<string | null> {
  const trimmed = text.trim().slice(0, 240)
  if (!trimmed) return null

  try {
    const url = new URL('https://api.mymemory.translated.net/get')
    url.searchParams.set('q', trimmed)
    url.searchParams.set('langpair', 'en|zh-CN')
    const res = await fetch(url.toString())
    if (!res.ok) return null

    const data = (await res.json()) as {
      responseData?: { translatedText?: string }
    }
    const translated = data.responseData?.translatedText?.trim()
    if (!translated || translated.toUpperCase() === trimmed.toUpperCase()) return null
    return sanitizeCn(translated)
  } catch {
    return null
  }
}

export async function lookupWithLlm(word: string, englishHint?: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY
  if (!apiKey) return null

  const baseUrl = process.env.LLM_BASE_URL || (process.env.DEEPSEEK_API_KEY
    ? 'https://api.deepseek.com/v1'
    : 'https://api.openai.com/v1')
  const model = process.env.LLM_MODEL || (process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini')

  const prompt = englishHint
    ? `将下列英文释义译为简洁的中文词典释义（只输出释义，不要解释）：\n单词：${word}\n英文：${englishHint}`
    : `给出英文单词「${word}」的简洁中文词典释义（只输出释义，不要解释）。`

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 80
      })
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    return content ? sanitizeCn(content) : null
  } catch {
    return null
  }
}

export async function resolveMissingMeaning(
  word: string,
  cnLookup: Map<string, KyleBingEntry>,
  cache: Record<string, { phonetic?: string; definition?: string; failed?: boolean }>,
  options: { useTranslate?: boolean; useLlm?: boolean } = {}
): Promise<LookupResult | null> {
  const { useTranslate = true, useLlm = true } = options
  const key = word.toLowerCase()

  let meaning = ''
  let englishMeaning = ''
  let phonetic = ''
  let source = ''

  const fromCn = lookupCnFromMap(key, cnLookup)
  if (fromCn?.meaning) {
    meaning = fromCn.meaning
    phonetic = fromCn.phonetic || ''
    source = 'ecdict/local'
  }

  const en = await fetchEnglishDefinition(key, cache)
  if (en) {
    englishMeaning = en.definition
    if (!phonetic) phonetic = en.phonetic
    if (!source) source = 'dictionaryapi.dev'
    else if (!source.includes('dictionaryapi')) source = `${source}+dictionaryapi.dev`
  } else if (fromCn?.englishMeaning) {
    englishMeaning = fromCn.englishMeaning
  }

  if (!meaning && englishMeaning && useTranslate) {
    const translated = await translateEnToZh(englishMeaning)
    if (translated) {
      meaning = translated
      if (!source) source = 'mymemory'
    }
    await sleep(200)
  }

  if (!meaning && useLlm) {
    const llm = await lookupWithLlm(key, englishMeaning || undefined)
    if (llm) {
      meaning = llm
      source = source ? `${source}+llm` : 'llm'
    }
  }

  if (!meaning && !englishMeaning) return null

  if (!meaning) meaning = `[待校对] ${key}`
  if (!englishMeaning) englishMeaning = meaning
  if (!phonetic) phonetic = `/${key}/`

  return {
    meaning: sanitizeCn(meaning),
    englishMeaning: englishMeaning.slice(0, 200),
    phonetic: sanitizePhonetic(phonetic),
    source
  }
}

function sanitizeCn(text: string): string {
  return text
    .replace(/^["'「『]|["'」』]$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizePhonetic(p: string): string {
  p = p.trim()
  if (!p) return ''
  if (!p.startsWith('/')) p = `/${p.replace(/^\/|\/$/g, '')}/`
  return p
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
