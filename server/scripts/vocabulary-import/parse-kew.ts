import fs from 'fs'
import path from 'path'

export interface KewUnitEntry {
  word: string
  pos?: string
  englishMeaning?: string
}

export interface KewUnit {
  id: string
  title: string
  theme?: string
  words: string[]
  entries?: KewUnitEntry[]
}

export interface KewBookSource {
  code: string
  name: string
  description: string
  level: string
  targetWordCount: number
  units: KewUnit[]
}

export interface KewCatalog {
  series: string
  publisher: string
  author: string
  source: string
  books: KewBookSource[]
}

export interface KewSenseOverride {
  senseKey: string
  senseLabel: string
  meaning: string
  englishMeaning: string
  phonetic?: string
}

export interface KewWordRef {
  word: string
  senseKey: string
  senseLabel: string
  meaning?: string
  englishMeaning?: string
  phonetic?: string
  pos?: string
  unitId: string
  unitTitle: string
  theme?: string
  tags: string[]
}

const SOURCE_PATH = path.join(__dirname, '../../data/sources/kew/kew-units.json')

/** 教材明确分义项教的同形词。键：bookCode:unitId:word */
export const KEW_SENSE_OVERRIDES: Record<string, KewSenseOverride> = {
  'kew1200-1:u1:fly': {
    senseKey: 'v',
    senseLabel: '飞',
    meaning: '飞；飞行',
    englishMeaning: 'to move through the air',
    phonetic: '/flaɪ/'
  },
  'kew1200-1:b4:fly': {
    senseKey: 'insect',
    senseLabel: '苍蝇',
    meaning: '苍蝇',
    englishMeaning: 'a small flying insect',
    phonetic: '/flaɪ/'
  },
  'kew1200-2:u9:tear': {
    senseKey: 'n',
    senseLabel: '眼泪',
    meaning: '眼泪',
    englishMeaning: 'a drop of liquid from the eye',
    phonetic: '/tɪə/'
  },
  'kew1200-2:u16:tear': {
    senseKey: 'v',
    senseLabel: '撕',
    meaning: '撕开；撕裂',
    englishMeaning: 'to pull something apart',
    phonetic: '/teə/'
  },
  'kew1200-1:u7:watch': {
    senseKey: 'v',
    senseLabel: '观看',
    meaning: '观看；注视',
    englishMeaning: 'to look at for a period of time',
    phonetic: '/wɒtʃ/'
  },
  'kew1200-3:b3:watch': {
    senseKey: 'n',
    senseLabel: '手表',
    meaning: '手表',
    englishMeaning: 'a small clock worn on the wrist',
    phonetic: '/wɒtʃ/'
  },
  'kew4500-1:u31:iron': {
    senseKey: 'metal',
    senseLabel: '铁',
    meaning: '铁',
    englishMeaning: 'a metal often used to make tools',
    phonetic: '/ˈaɪən/'
  },
  'kew4500-4:u18:iron': {
    senseKey: 'appliance',
    senseLabel: '熨斗',
    meaning: '熨斗',
    englishMeaning: 'a heated electrical device used to smooth clothes',
    phonetic: '/ˈaɪən/'
  },
  'kew4500-1:u14:major': {
    senseKey: 'n',
    senseLabel: '专业',
    meaning: '大学主修专业',
    englishMeaning: 'the main subject one studies at college',
    phonetic: '/ˈmeɪdʒə/'
  },
  'kew4500-4:u40:major': {
    senseKey: 'adj',
    senseLabel: '重大的',
    meaning: '重大的；主要的',
    englishMeaning: 'great in importance, size, or degree',
    phonetic: '/ˈmeɪdʒə/'
  },
  'kew4500-3:u40:resolution': {
    senseKey: 'solution',
    senseLabel: '解决',
    meaning: '解决办法',
    englishMeaning: 'a solution to a problem or difficulty',
    phonetic: '/ˌrezəˈluːʃn/'
  },
  'kew4500-4:u38:resolution': {
    senseKey: 'decision',
    senseLabel: '决心',
    meaning: '决心；决议',
    englishMeaning: 'a serious decision to do something',
    phonetic: '/ˌrezəˈluːʃn/'
  },
  'kew4500-1:u24:sense': {
    senseKey: 'feeling',
    senseLabel: '感觉',
    meaning: '感觉；意识',
    englishMeaning: 'a feeling about something important',
    phonetic: '/sens/'
  },
  'kew4500-2:u38:sense': {
    senseKey: 'perception',
    senseLabel: '感官',
    meaning: '视觉、听觉等感官',
    englishMeaning: 'an ability to see, hear, smell, taste, or feel',
    phonetic: '/sens/'
  }
}

export function loadKewCatalog(filePath: string = SOURCE_PATH): KewCatalog {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as KewCatalog
}

export function normalizeKewWord(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function kewSenseLookupKey(bookCode: string, unitId: string, word: string): string {
  return `${bookCode}:${unitId}:${normalizeKewWord(word)}`
}

export function unitItems(unit: KewUnit): KewUnitEntry[] {
  if (unit.entries?.length) return unit.entries
  return (unit.words || []).map(word => ({ word }))
}

export function validateKewBook(book: KewBookSource): string[] {
  const errors: string[] = []
  for (const unit of book.units) {
    const items = unitItems(unit)
    if (items.length !== 20) {
      errors.push(`${book.code} ${unit.title}: ${items.length} words (expected 20)`)
    }
    const empty = items.filter(item => !normalizeKewWord(item.word))
    if (empty.length) {
      errors.push(`${book.code} ${unit.title}: empty word entries`)
    }
  }
  return errors
}

function identityKey(word: string, senseKey: string): string {
  return `${word}::${senseKey}`
}

/** 按单元顺序展开主题词；同形不同义保留为独立义项 */
export function flattenKewBook(book: KewBookSource): {
  words: KewWordRef[]
  duplicates: Array<{ word: string; firstUnit: string; skippedUnit: string }>
} {
  const seen = new Map<string, string>()
  const words: KewWordRef[] = []
  const duplicates: Array<{ word: string; firstUnit: string; skippedUnit: string }> = []

  for (const unit of book.units) {
    for (const item of unitItems(unit)) {
      const word = normalizeKewWord(item.word)
      if (!word) continue
      const override = KEW_SENSE_OVERRIDES[kewSenseLookupKey(book.code, unit.id, word)]
      const senseKey = override?.senseKey || ''
      const id = identityKey(word, senseKey)
      const firstUnit = seen.get(id)
      if (firstUnit) {
        duplicates.push({ word, firstUnit, skippedUnit: unit.title })
        continue
      }
      seen.set(id, unit.title)
      const tags = [`kew-unit:${unit.id}`]
      if (unit.theme) tags.push(`theme:${unit.theme}`)
      if (senseKey) tags.push(`sense:${senseKey}`)
      const pos = item.pos?.trim()
      if (pos) tags.push(`pos:${pos.replace(/\s+/g, '')}`)
      words.push({
        word,
        senseKey,
        senseLabel: override?.senseLabel || '',
        meaning: override?.meaning,
        englishMeaning: override?.englishMeaning || item.englishMeaning,
        phonetic: override?.phonetic,
        pos,
        unitId: unit.id,
        unitTitle: unit.title,
        theme: unit.theme,
        tags
      })
    }
  }

  return { words, duplicates }
}
