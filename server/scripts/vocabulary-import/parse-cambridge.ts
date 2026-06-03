/** 从 Cambridge 官方词表 PDF 提取文本中解析 headword */
const POS_RE =
  /([a-zA-Z0-9][a-zA-Z0-9'\-/]*(?:\s+[a-z]+(?:\s+[a-z]+)?)?)\s*\((?:n|v|adj|adv|prep|conj|det|pron|mv|exclam|phr v|av|n & v|adj & n|n pl|det & pron|adv & prep)[^)]*\)/g

const SKIP = new Set([
  'a', 'an', 'the', 'br eng', 'am eng', 'page', 'ucles', 'cup', 'key', 'schools',
  'contents', 'appendix', 'introduction', 'summary', 'organisation', 'background'
])

function normalizeHeadword(raw: string): string | null {
  let w = raw.trim().replace(/\s+/g, ' ')
  if (!w || w.length < 2) return null
  if (/^\d+$/.test(w)) return null
  if (SKIP.has(w.toLowerCase())) return null
  if (/^(january|february|march|april|may|june|july|august|september|october|november|december)$/i.test(w)) {
    return w.toLowerCase()
  }
  // a/an -> skip multi det
  if (w.includes('/')) {
    const parts = w.split('/').map(p => p.trim())
    if (parts.every(p => p.length <= 3)) return null
    w = parts[0]
  }
  return w.toLowerCase()
}

export function parseCambridgePdfText(text: string): string[] {
  const found = new Set<string>()
  let m: RegExpExecArray | null

  while ((m = POS_RE.exec(text)) !== null) {
    const word = normalizeHeadword(m[1])
    if (word) found.add(word)
  }

  return [...found].sort()
}
