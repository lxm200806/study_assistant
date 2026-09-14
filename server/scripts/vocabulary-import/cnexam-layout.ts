import path from 'path'
import { loadNormalizedGlosses, type KewGloss } from './kew-gloss'

/** 国内考试：中考 / 高考 / 大学英语四级 / 六级 */
export type CnexamBook = 'zhongkao' | 'gaokao' | 'cet4' | 'cet6'

export const CNEXAM_BOOKS: CnexamBook[] = ['zhongkao', 'gaokao', 'cet4', 'cet6']

export const SERVER_ROOT = path.join(__dirname, '../..')
export const SOURCES_ROOT = path.join(SERVER_ROOT, 'data/sources')
export const CNEXAM_ROOT = path.join(SOURCES_ROOT, 'cnexam')
export const BOOKS_DIR = path.join(SERVER_ROOT, 'data/vocabulary/books')

export function cnexamGlossPath(code: CnexamBook): string {
  return path.join(CNEXAM_ROOT, `${code}-glosses.json`)
}

export function cnexamBookPath(code: CnexamBook): string {
  return path.join(BOOKS_DIR, `${code}.json`)
}

export function loadCnexamGlosses(code: CnexamBook): Record<string, KewGloss> {
  return loadNormalizedGlosses(cnexamGlossPath(code))
}

/** 国内考试 gloss，供释义查找。 */
export function loadCnexamMeaningLookup(): Map<string, {
  word: string
  meaning: string
  phonetic: string
  englishMeaning: string
}> {
  const map = new Map<string, { word: string; meaning: string; phonetic: string; englishMeaning: string }>()
  for (const code of ['cet6', 'cet4', 'gaokao', 'zhongkao'] as CnexamBook[]) {
    const glosses = loadCnexamGlosses(code)
    for (const [key, gloss] of Object.entries(glosses)) {
      const word = key
      map.set(word, {
        word,
        meaning: gloss.meaning,
        phonetic: gloss.phonetic,
        englishMeaning: gloss.englishMeaning
      })
    }
  }
  return map
}

export function cnexamGlossWords(code: CnexamBook): string[] {
  return [...new Set(Object.keys(loadCnexamGlosses(code)))]
}
