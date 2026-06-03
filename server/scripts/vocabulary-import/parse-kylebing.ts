export interface KyleBingEntry {
  word: string
  meaning: string
  phonetic: string
  englishMeaning: string
}

/** 解析 KyleBing 乱序 txt: word<TAB>pos. 中文；... */
export function parseKyleBingTxt(content: string): Map<string, KyleBingEntry> {
  const map = new Map<string, KyleBingEntry>()

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const tab = trimmed.indexOf('\t')
    if (tab <= 0) continue

    const word = trimmed.slice(0, tab).trim().toLowerCase()
    const rest = trimmed.slice(tab + 1).trim()
    if (!word || !/^[a-zA-Z][a-zA-Z0-9' -]*$/.test(word)) continue

    const meaning = extractPrimaryChineseMeaning(rest)
    if (!meaning || meaning.length < 1) continue

    const englishMeaning = extractEnglishHint(rest)

    map.set(word, {
      word,
      meaning,
      phonetic: '',
      englishMeaning
    })
  }

  return map
}

function extractPrimaryChineseMeaning(rest: string): string {
  // 去掉词性前缀 n. v. adj. 等
  let s = rest.replace(/^[a-z]+\.\s*/i, '')
  s = s.replace(/^[a-z]+\.\s*/g, '')

  // 取第一个中文义项（分号/顿号前）
  const parts = s.split(/[；;]/).map(p => p.trim()).filter(Boolean)
  let primary = parts[0] || s

  // 去掉英文括注 (Am Eng: ...)
  primary = primary.replace(/\(Am Eng[^)]*\)/gi, '')
  primary = primary.replace(/\(Br Eng[^)]*\)/gi, '')
  primary = primary.replace(/\[[^\]]*\]/g, '')
  primary = primary.trim()

  // 只保留含中文的片段
  if (!/[\u4e00-\u9fff]/.test(primary)) {
    const cnMatch = rest.match(/[\u4e00-\u9fff][^；;]*/)
    primary = cnMatch ? cnMatch[0].trim() : ''
  }

  return primary.slice(0, 80)
}

function extractEnglishHint(rest: string): string {
  const enParts = rest.match(/[a-zA-Z][a-zA-Z\s,'-]{3,}/g)
  if (!enParts) return ''
  const filtered = enParts.filter(p => !/^(n|v|adj|adv|prep|conj|det|pron|num|art)\.?$/i.test(p.trim()))
  return filtered[0]?.trim().slice(0, 120) || ''
}
