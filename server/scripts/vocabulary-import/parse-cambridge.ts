import { isParseArtifact } from '../../src/utils/word-quality'

const POS_TAG =
  /^(?:n(?:\s*&\s*v|\s+pl)?|v|adj(?:\s*&\s*n)?|adv(?:\s*&\s*(?:prep|adj))?|prep(?:\s+phr)?|conj|det(?:\s*&[^)]*)?|pron|mv|exclam|phr v|av(?:\s*&\s*v)?)(?:\s|,|&|$)/i

const SKIP = new Set([
  'a', 'an', 'the', 'br eng', 'am eng', 'page', 'ucles', 'cup', 'key', 'schools',
  'contents', 'appendix', 'introduction', 'summary', 'organisation', 'background', 'not'
])

/** 单独作为词尾时不构成 headword，需向前扩展（如 all sorts of） */
const TAIL_STOP = new Set([
  'of', 'to', 'a', 'an', 'the', 'for', 'with', 'in', 'on', 'at', 'by', 'from', 'and', 'or', 'as',
  'be', 'is', 'was', 'are', 'am', 'up', 'out', 'off', 'into', 'over', 'under', 'through', 'during',
  'before', 'after', 'while', 'than', 'then', 'so', 'if', 'not', 'just', 'also', 'too', 'very',
  'some', 'any', 'each', 'every', 'both', 'either', 'neither', 'no', 'nor', 'yet', 'still',
  'already', 'again', 'here', 'there', 'now', 'well', 'only', 'own', 'same', 'other', 'such'
])

const VALID_MULTI = new Set([
  'a few', 'a little', 'a lot', 'a bit', 'a.m.', 'p.m.', 'as well', 'as well as', 'all sorts of',
  'all kinds of', 'all the time', 'all right', 'alright', 'because of', 'by accident', 'by post',
  'by the way', 'by air', 'car park', 'credit card', 'bus stop', 'bus station', 'alarm clock',
  'cell phone', 'swimming pool', 'sports centre', 'department store', 'living room', 'dining room',
  'washing machine', 'good morning', 'good afternoon', 'good evening', 'good night', 'goodbye',
  'good bye', 'how much', 'how many', 'how long', 'how often', 'how far', 'how old', 'how about',
  'lots of', 'kind of', 'sort of', 'out of', 'next to', 'close to', 'due to', 'according to',
  'instead of', 'as soon as', 'as long as', 'as far as', 'as good as', 'as well as', 'each other',
  'every one', 'everyone', 'no one', 'at all', 'at least', 'at first', 'at last', 'at once',
  'at home', 'at work', 'at school', 'on time', 'in time', 'in front of', 'in spite of',
  'in order to', 'look after', 'look at', 'look for', 'look like', 'get up', 'get on', 'get off',
  'get in', 'get out', 'go out', 'go on', 'go back', 'go shopping', 'wake up', 'sit down',
  'turn on', 'turn off', 'pick up', 'put on', 'take off', 'find out', 'work out', 'write down',
  'come back', 'bring back', 'break down', 'check in', 'check out', 'try on', 'pay for',
  'wait for', 'listen to', 'talk about', 'think about', 'learn about', 'book about',
  'apartment building', 'bathing suit', 'board game', 'business person', 'city centre',
  'credit card', 'digital camera', 'fast food', 'first name', 'football player',
  'french fries', 'swimming costume', 'table tennis', 'tennis player', 'tour guide',
  'tourist information centre', 'traffic light', 'washing machine', 'air conditioning',
  'air force', 'bank account', 'boarding pass', 'booking office', 'bottle bank',
  'brand new', 'at the same time', 'at present', 'north america', 'south america',
  'would prefer', 'well made'
])

function isPosParen(inner: string): boolean {
  const s = inner.trim()
  if (/^(br eng|am eng|not|e\.g\.)/i.test(s)) return false
  return POS_TAG.test(s)
}

function extractAlphabeticalSection(text: string): string {
  const start = text.search(/a\/an\s*\(det\)/i)
  const appendix = text.search(/\nAppendix 1\b/i)
  if (start === -1) return text
  const end = appendix === -1 ? text.length : appendix
  return text.slice(start, end)
}

function tokenizeSegment(segment: string): string[] {
  return (segment.match(/[a-zA-Z0-9][a-zA-Z0-9'\-/]*(?:\/[a-zA-Z0-9'\-]+)*/g) || [])
    .map(t => t.trim())
    .filter(Boolean)
}

function looksLikeExampleFragment(candidate: string): boolean {
  if (VALID_MULTI.has(candidate.toLowerCase())) return false
  return /^(be|to join|get |go |have |has |had |can |could |will |would |should |may |might |must |do |does |did |I |We |You |He |She |They |My |Your |What |How |Where |When |Why |Who |Which |Don't |Yes |No |Someone |Can |Could |Would |Shall |Is |Are |Was |Were )/i.test(
    candidate
  )
}

function restAfterPosParen(text: string, openParenIdx: number): string {
  const close = text.indexOf(')', openParenIdx)
  return close === -1 ? '' : text.slice(close + 1).trim()
}

function extractHeadwordBeforeParen(text: string, openParenIdx: number): string | null {
  const slice = text.slice(Math.max(0, openParenIdx - 120), openParenIdx)
  const segment = slice.split(/[•·]/).pop()!.split(/\)/).pop()!.trim()
  const tokens = tokenizeSegment(segment)
  if (tokens.length === 0) return null

  const rest = restAfterPosParen(text, openParenIdx)
  const dedicatedLine = !rest || /^(\([^)]+\)|Br Eng|Am Eng)/i.test(rest)

  // Official alternatives: "lots / a lot (n)", "prefer / would prefer (v)"
  if (dedicatedLine && segment.includes('/')) {
    return segment.replace(/\s+/g, ' ')
  }

  if (dedicatedLine && tokens.length === 2) {
    const full = tokens.join(' ')
    const lower = full.toLowerCase()
    if (!looksLikeExampleFragment(full) && (VALID_MULTI.has(lower) || (!isParseArtifact(full) && !TAIL_STOP.has(tokens[0].toLowerCase())))) {
      return full
    }
  }
  if (dedicatedLine && tokens.length >= 3 && tokens.length <= 4) {
    const full = tokens.join(' ')
    if (VALID_MULTI.has(full.toLowerCase()) && !looksLikeExampleFragment(full)) return full
  }

  for (let n = Math.min(4, tokens.length); n >= 1; n--) {
    const candidate = tokens.slice(-n).join(' ')
    const lower = candidate.toLowerCase()
    if (looksLikeExampleFragment(candidate)) continue
    if (n > 1 && !VALID_MULTI.has(lower) && isParseArtifact(candidate)) continue
    if (n === 1) {
      if (TAIL_STOP.has(lower)) continue
      return candidate
    }
    if (VALID_MULTI.has(lower)) return candidate
    if (n === 1 && candidate.includes('-')) return candidate
  }

  const fallback = tokens[tokens.length - 1]
  if (TAIL_STOP.has(fallback.toLowerCase())) return null
  return fallback
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
]
const SEASONS = ['spring', 'summer', 'autumn', 'winter']
const CONTINENTS = ['africa', 'antarctica', 'asia', 'australia', 'europe', 'north america', 'south america']
const CARDINALS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand'
]
const ORDINALS = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
  'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first'
]
const SAMPLE_NATIONS = [
  'brazil', 'brazilian', 'canada', 'canadian', 'china', 'chinese', 'france', 'french',
  'ireland', 'irish', 'india', 'indian', 'italy', 'italian', 'spain', 'spanish',
  'england', 'english', 'america', 'american', 'britain', 'british', 'australia', 'australian'
]

const TOPIC_SKIP = new Set([
  ...SKIP,
  'vocabulary', 'list', 'topic', 'lists', 'word', 'sets', 'additions', 'green',
  'etc', 'example', 'others', 'for', 'and', 'of', 'the', 'to', 'or'
])

function normalizeHeadword(raw: string): string | null {
  let w = raw.trim().replace(/\s+/g, ' ').replace(/^[([{]+|[)\]},;:]+$/g, '')
  if (!w || w.length < 2) return null
  const lower = w.toLowerCase()
  if (VALID_MULTI.has(lower)) return lower
  if (/^\d+$/.test(w) || /[()[\]{}]/.test(w)) return null
  if (/^(e\.g\.?|etc|n|v|adj|adv|prep|det|pron|mv|pl|phr|av|conj|sth|upon sth)$/i.test(w)) return null
  if (/^(caf cafe|doctor dr|dr doctor|maths mathematics|well made well-made|hobby paint|light stay|news read|note study|password text|seat underground|surf watch|magazine photograph)$/i.test(w)) return null
  if (SKIP.has(lower) || TOPIC_SKIP.has(lower)) return null
  if (isParseArtifact(w)) return null

  if (w.includes('/')) {
    const parts = w.split('/').map(p => p.trim())
    if (parts.every(p => p.length <= 3)) return null
    w = parts[0]
  }

  return w.toLowerCase()
}

function addHeadword(found: Set<string>, raw: string | null) {
  if (!raw) return
  const pieces = raw.split('/').map(part => part.trim()).filter(Boolean)
  const targets = pieces.length > 1 ? pieces : [raw]
  for (const target of targets) {
    const word = normalizeHeadword(target)
    if (word) found.add(word)
  }
}

function collectPosHeadwords(section: string, found: Set<string>) {
  const parenRe = /\(([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = parenRe.exec(section)) !== null) {
    if (!isPosParen(m[1])) continue
    addHeadword(found, extractHeadwordBeforeParen(section, m.index))
  }
}

function collectLineHeadwords(section: string, found: Set<string>) {
  for (const rawLine of section.split(/\n+/)) {
    if (/^\s*[•·]/.test(rawLine)) continue
    for (const part of rawLine.split(/[•·]/)) {
      const line = part.trim()
      if (!line || isFooterLine(line) || isTopicHeading(line)) continue
      collectPosHeadwords(line, found)
    }
  }
}

function officialPhrases(words: Iterable<string>): string[] {
  return [...words].filter(word => word.includes(' ')).sort((a, b) => b.length - a.length)
}

function consumeTopicTokens(line: string, phrases: string[], found: Set<string>) {
  const cleaned = line.replace(/\([^)]+\)/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return
  const lower = cleaned.toLowerCase()
  let i = 0
  const tokens = cleaned.split(' ')
  const lowerTokens = lower.split(' ')
  while (i < tokens.length) {
    let matched = ''
    for (const phrase of phrases) {
      const parts = phrase.split(' ')
      if (lowerTokens.slice(i, i + parts.length).join(' ') === phrase) {
        matched = phrase
        break
      }
    }
    if (matched) {
      addHeadword(found, matched)
      i += matched.split(' ').length
      continue
    }
    addHeadword(found, tokens[i])
    i += 1
  }
}

function sliceSection(text: string, startRe: RegExp, endRe?: RegExp): string {
  const start = text.search(startRe)
  if (start === -1) return ''
  const rest = text.slice(start)
  if (!endRe) return rest
  const end = rest.search(endRe)
  return end === -1 ? rest : rest.slice(0, end)
}

function isFooterLine(line: string): boolean {
  return /ucles|page \d+|vocabulary list|key and key|preliminary and preliminary/i.test(line)
}

function isTopicHeading(line: string): boolean {
  if (/\([^)]+\)/.test(line)) return false
  const words = line.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 6) return false
  return words.every(word =>
    /^(and|of|the|or|&)$/i.test(word) || /^[A-Z][A-Za-z/'’-]*$/.test(word)
  )
}

function parseAppendix1(text: string): string[] {
  const section = sliceSection(text, /\nAppendix 1\b/i, /\nAppendix 2\b/i)
  if (!section) return []
  const found = new Set<string>([...CARDINALS, ...ORDINALS, ...DAYS, ...MONTHS, ...SEASONS, ...CONTINENTS, ...SAMPLE_NATIONS])
  collectPosHeadwords(section, found)
  return [...found]
}

function parseAppendix2(text: string, extraPhrases: string[] = []): string[] {
  const section = sliceSection(text, /\nAppendix 2\b/i)
  if (!section) return []
  const found = new Set<string>()
  collectPosHeadwords(section, found)

  if (/january\s*[-–]\s*december/i.test(section)) MONTHS.forEach(item => found.add(item))
  if (/monday\s*[-–]\s*sunday/i.test(section)) DAYS.forEach(item => found.add(item))

  const phrases = officialPhrases([...found, ...extraPhrases, ...VALID_MULTI])
  for (const line of section.split(/\n+/)) {
    const trimmed = line.trim()
    if (!trimmed || isFooterLine(trimmed) || isTopicHeading(trimmed)) continue
    if (/^appendix|topic lists|word sets/i.test(trimmed)) continue
    consumeTopicTokens(trimmed, phrases, found)
  }
  return [...found]
}

export function parseCambridgePdfText(text: string): string[] {
  return parseCambridgeOfficialList(text).all
}

export function parseCambridgeOfficialList(text: string): {
  alpha: string[]
  appendix1: string[]
  appendix2: string[]
  all: string[]
} {
  const alpha = new Set<string>()
  collectLineHeadwords(extractAlphabeticalSection(text), alpha)
  const appendix1 = parseAppendix1(text)
  const appendix2 = parseAppendix2(text, officialPhrases(alpha))
  const all = new Set([...alpha, ...appendix1, ...appendix2])
  return {
    alpha: [...alpha].sort(),
    appendix1: [...appendix1].sort(),
    appendix2: [...appendix2].sort(),
    all: [...all].sort()
  }
}
