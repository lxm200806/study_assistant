/** Ported from TypeWords `normalizeWord` — dictation compare normalization. */

const charMap: Record<string, string> = {
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  ' ': ' ',
  '。': '.',
  '，': ',',
  '？': '?',
  '【': '[',
  '】': ']',
  '￥': '$',
  '！': '!',
  '（': '(',
  '）': ')',
  '《': '<',
  '》': '>'
}

export function normalizeWord(word: string) {
  return word
    .split('')
    .map(ch => charMap[ch] || ch)
    .join('')
}