/**
 * Ported from TypeWords `parseSentence` (app/core/hooks/article.ts).
 * Spaces are NOT tokens — they become `nextSpace` between words.
 */

export enum TokenType {
  Word = 'word',
  Number = 'number',
  Symbol = 'symbol'
}

export interface TypingToken {
  word: string
  nextSpace: boolean
  type: TokenType
  input: string
}

export function parseTypingTokens(sentence: string): TypingToken[] {
  sentence = sentence
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')

  const len = sentence.length
  const tokens: Array<{ word: string; start: number; end: number; type: TokenType }> = []
  let i = 0

  while (i < len) {
    const ch = sentence[i]

    if (/\s/.test(ch)) {
      i++
      continue
    }

    const rest = sentence.slice(i)

    let m = rest.match(/^[$¥€£]\d{1,3}(?:,\d{3})*(?:\.\d+)?%?/)
    if (m) {
      tokens.push({ word: m[0], start: i, end: i + m[0].length, type: TokenType.Number })
      i += m[0].length
      continue
    }

    m = rest.match(/^\d{1,3}(?:,\d{3})*(?:\.\d+)?%?/)
    if (m) {
      tokens.push({ word: m[0], start: i, end: i + m[0].length, type: TokenType.Number })
      i += m[0].length
      continue
    }

    m = rest.match(/^[A-Za-z]+(?:\.[A-Za-z]+)+\.?/)
    if (m) {
      tokens.push({ word: m[0], start: i, end: i + m[0].length, type: TokenType.Word })
      i += m[0].length
      continue
    }

    m = rest.match(/^[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/)
    if (m) {
      tokens.push({ word: m[0], start: i, end: i + m[0].length, type: TokenType.Word })
      i += m[0].length
      continue
    }

    if (/[^\w\s]/.test(ch)) {
      tokens.push({ word: ch, start: i, end: i + 1, type: TokenType.Symbol })
      i += 1
      continue
    }

    tokens.push({ word: ch, start: i, end: i + 1, type: TokenType.Symbol })
    i += 1
  }

  return tokens.map((t, idx) => {
    const next = tokens[idx + 1]
    const between = next ? sentence.slice(t.end, next.start) : sentence.slice(t.end)
    return {
      word: t.word,
      nextSpace: /\s/.test(between),
      type: t.type,
      input: ''
    }
  })
}

export function targetNeedsTokenFlow(text: string): boolean {
  return /\s/.test(text.trim())
}
