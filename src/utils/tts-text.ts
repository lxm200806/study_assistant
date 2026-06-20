const MAX_TTS_LENGTH = 120

/** 去掉 emoji、Markdown、弯引号、箭头等，只保留可朗读的 ASCII 文本 */
export function sanitizeForTts(text: string, maxLen = MAX_TTS_LENGTH): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[\u2018\u2019\u201A\u2032\u2035`´]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033\u2036«»]/g, '"')
    .replace(/[\u2190-\u21FF\u27A0-\u27BF]/gu, ' ')
    .replace(/[*_~#|\\[\]{}>]/g, ' ')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
    .trim()
}

export function isValidTtsText(text: string, maxLen = MAX_TTS_LENGTH): boolean {
  const trimmed = sanitizeForTts(text, maxLen)
  if (!trimmed) return false
  const letters = trimmed.match(/[a-zA-Z]/g)
  return !!letters && letters.length >= 2
}

/** 按完整句子切分，仅在单句超过 maxLen 时才在逗号/空格处二次切分 */
export function splitTextForTts(text: string, maxLen = MAX_TTS_LENGTH): string[] {
  const clean = sanitizeForTts(text, 4000)
  if (!clean) return []

  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const units = sentences.length > 0 ? sentences : [clean]
  const parts: string[] = []

  for (const sentence of units) {
    if (sentence.length <= maxLen) {
      parts.push(sentence)
      continue
    }

    let rest = sentence
    while (rest.length > maxLen) {
      let cut = rest.lastIndexOf(', ', maxLen)
      if (cut < maxLen * 0.4) cut = rest.lastIndexOf(' ', maxLen)
      if (cut < 20) cut = maxLen
      const piece = rest.slice(0, cut).trim()
      if (piece) parts.push(piece)
      rest = rest.slice(cut).trim().replace(/^,\s*/, '')
    }
    if (rest) parts.push(rest)
  }

  return parts.filter((part) => isValidTtsText(part))
}

export { MAX_TTS_LENGTH }
