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
  'wait for', 'listen to', 'talk about', 'think about', 'learn about', 'book about'
])

function isPosParen(inner: string): boolean {
  const s = inner.trim()
  if (/^(br eng|am eng|not|e\.g\.)/i.test(s)) return false
  return POS_TAG.test(s)
}

function extractAlphabeticalSection(text: string): string {
  const start = text.search(/a\/an\s*\(det\)/i)
  const appendix = text.search(/\nAppendix 1\n/i)
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
  return /^(be|to join|get |go |have |has |had |can |could |will |would |should |may |might |must |do |does |did |I |We |You |He |She |They |My |Your |The |A |An |What |How |Where |When |Why |Who |Which |Don't |Yes |No |Someone |Can |Could |Would |Shall |Is |Are |Was |Were )/i.test(
    candidate
  )
}

function extractHeadwordBeforeParen(text: string, openParenIdx: number): string | null {
  const slice = text.slice(Math.max(0, openParenIdx - 120), openParenIdx)
  const segment = slice.split(/[•]/).pop()!.split(/\)/).pop()!.trim()
  const tokens = tokenizeSegment(segment)
  if (tokens.length === 0) return null

  const maxWords = 4
  for (let n = 1; n <= Math.min(maxWords, tokens.length); n++) {
    const candidate = tokens.slice(-n).join(' ')
    const lower = candidate.toLowerCase()
    const lastToken = tokens[tokens.length - 1].toLowerCase()

    if (n === 1 && TAIL_STOP.has(lastToken)) continue
    if (n < tokens.length && TAIL_STOP.has(lastToken) && !VALID_MULTI.has(lower)) continue
    if (looksLikeExampleFragment(candidate)) continue
    if (isParseArtifact(candidate)) continue
    if (n >= 2 && !VALID_MULTI.has(lower) && !candidate.includes('/') && !candidate.includes('-')) {
      const first = tokens[tokens.length - n].toLowerCase()
      if (TAIL_STOP.has(first) || ['join', 'get', 'go', 'make', 'take', 'give', 'come', 'bring'].includes(first)) {
        continue
      }
    }
    return candidate
  }

  const fallback = tokens[tokens.length - 1]
  if (TAIL_STOP.has(fallback.toLowerCase())) return null
  return fallback
}

function normalizeHeadword(raw: string): string | null {
  let w = raw.trim().replace(/\s+/g, ' ')
  if (!w || w.length < 2) return null
  if (/^\d+$/.test(w)) return null
  if (SKIP.has(w.toLowerCase())) return null
  if (isParseArtifact(w)) return null

  if (w.includes('/')) {
    const parts = w.split('/').map(p => p.trim())
    if (parts.every(p => p.length <= 3)) return null
    w = parts[0]
  }

  if (/^(january|february|march|april|may|june|july|august|september|october|november|december)$/i.test(w)) {
    return w.toLowerCase()
  }

  return w.toLowerCase()
}

export function parseCambridgePdfText(text: string): string[] {
  const main = extractAlphabeticalSection(text)
  const found = new Set<string>()
  const parenRe = /\(([^)]+)\)/g
  let m: RegExpExecArray | null

  while ((m = parenRe.exec(main)) !== null) {
    if (!isPosParen(m[1])) continue
    const raw = extractHeadwordBeforeParen(main, m.index)
    if (!raw) continue
    const word = normalizeHeadword(raw)
    if (word) found.add(word)
  }

  return [...found].sort()
}
