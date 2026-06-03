import fs from 'fs'
import path from 'path'
import readline from 'readline'

export interface EcdictEntry {
  word: string
  phonetic: string
  meaning: string
  englishMeaning: string
}

/** 解析 ECDICT CSV（word,phonetic,definition,translation,...） */
export async function loadEcdictCsv(filePath: string): Promise<Map<string, EcdictEntry>> {
  const map = new Map<string, EcdictEntry>()
  if (!fs.existsSync(filePath)) return map

  const stat = fs.statSync(filePath)
  if (stat.size < 100_000) {
    console.warn(`ECDICT 文件过小 (${stat.size} bytes)，跳过: ${filePath}`)
    return map
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity
  })

  let lineNo = 0
  for await (const line of rl) {
    lineNo++
    if (lineNo === 1) continue
    const entry = parseCsvLine(line)
    if (!entry) continue
    const key = entry.word.toLowerCase()
    if (!map.has(key)) map.set(key, entry)
  }

  console.log(`ECDICT 加载: ${map.size} 词条`)
  return map
}

function parseCsvLine(line: string): EcdictEntry | null {
  const fields = splitCsvFields(line)
  if (fields.length < 4) return null

  const word = fields[0]?.trim().toLowerCase()
  const phonetic = fields[1]?.trim() || ''
  const definition = fields[2]?.trim() || ''
  const translation = fields[3]?.trim() || ''

  if (!word || !/^[a-z][a-z0-9' -]*$/.test(word)) return null

  const meaning = extractPrimaryChinese(translation)
  if (!meaning) return null

  return {
    word,
    phonetic: phonetic ? `/${phonetic.replace(/^\/|\/$/g, '')}/` : '',
    meaning,
    englishMeaning: definition.slice(0, 200) || meaning
  }
}

function extractPrimaryChinese(translation: string): string {
  if (!translation || !/[\u4e00-\u9fff]/.test(translation)) return ''
  const firstLine = translation.split(/\\n|\n/)[0] || translation
  const cleaned = firstLine
    .replace(/^[a-z]+\.\s*/gi, '')
    .replace(/\[网络\][^\n]*/gi, '')
    .trim()
  const primary = cleaned.split(/[；;]/)[0]?.trim() || cleaned
  return primary.slice(0, 80)
}

function splitCsvFields(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

export function ecdictToKyleBingMap(ecdict: Map<string, EcdictEntry>) {
  const map = new Map<string, { word: string; meaning: string; phonetic: string; englishMeaning: string }>()
  for (const [k, v] of ecdict) {
    map.set(k, {
      word: v.word,
      meaning: v.meaning,
      phonetic: v.phonetic,
      englishMeaning: v.englishMeaning
    })
  }
  return map
}
