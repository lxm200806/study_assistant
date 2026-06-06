const MAX_TTS_LENGTH = 120

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

export { MAX_TTS_LENGTH }
