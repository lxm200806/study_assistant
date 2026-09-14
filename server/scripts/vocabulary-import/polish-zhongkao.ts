#!/usr/bin/env ts-node
/**
 * 校准中考词汇：短汉语、简单英文、小学生能看懂的例句。
 * 优先用 KEW 1200，其次手写补充，再次 KEW 4500。
 * 用法: npx ts-node --transpile-only scripts/vocabulary-import/polish-zhongkao.ts
 */
import fs from 'fs'
import path from 'path'
import type { WordData, WordSources } from '../../src/data/vocabulary/types'
import { loadNormalizedGlosses, writeNormalizedGlosses, type KewGloss } from './kew-gloss'
import { sourceTags } from './book-word'
import { ZHONGKAO_EXTRA } from './zhongkao-extra-glosses'
import { cnexamBookPath, cnexamGlossPath } from './cnexam-layout'
import { KEW_ROOT } from './kew-layout'

const GLOSS_PATH = cnexamGlossPath('zhongkao')
const BOOK_PATH = cnexamBookPath('zhongkao')
const LIST_SOURCE = 'kylebing-junior'
const EDITOR = 'editor-zhongkao'

type Origin = 'kew1200' | 'kew4500' | 'editor-zhongkao'

interface SourcedGloss extends KewGloss {
  origin: Origin
}

function loadKewGlosses(series: 'kew1200' | 'kew4500', count: number): Record<string, KewGloss> {
  const map: Record<string, KewGloss> = {}
  for (let i = 1; i <= count; i++) {
    const file = path.join(KEW_ROOT, series, `${series}-${i}-glosses.json`)
    const data = loadNormalizedGlosses(file)
    for (const [word, gloss] of Object.entries(data)) {
      if (!map[word]) map[word] = gloss
    }
  }
  return map
}

function buildGlossMap(words: string[]): Record<string, SourcedGloss> {
  const kew1200 = loadKewGlosses('kew1200', 3)
  const kew4500 = loadKewGlosses('kew4500', 4)
  const map: Record<string, SourcedGloss> = {}
  for (const word of words) {
    const extra = ZHONGKAO_EXTRA[word]
    if (extra) {
      const phonetic = kew1200[word]?.phonetic || kew4500[word]?.phonetic || ''
      map[word] = { ...extra, phonetic, origin: 'editor-zhongkao' }
    } else if (kew1200[word]) {
      map[word] = { ...kew1200[word], origin: 'kew1200' }
    } else if (kew4500[word]) {
      map[word] = { ...kew4500[word], origin: 'kew4500' }
    }
  }
  return map
}

function meaningSource(origin: Origin): string {
  if (origin === 'kew1200') return 'editor-elementary'
  if (origin === 'kew4500') return 'editor-series'
  return EDITOR
}

function polishBook() {
  const book = JSON.parse(fs.readFileSync(BOOK_PATH, 'utf-8')) as {
    words: WordData[]
    [key: string]: unknown
  }
  const words = book.words.map(item => item.word.toLowerCase())
  const glosses = buildGlossMap(words)
  const missing: string[] = []
  const byOrigin: Record<Origin, number> = { kew1200: 0, kew4500: 0, 'editor-zhongkao': 0 }

  book.words = book.words.map(item => {
    const word = item.word.toLowerCase()
    const gloss = glosses[word]
    if (!gloss) {
      missing.push(word)
      return item
    }
    byOrigin[gloss.origin] += 1
    const sources: WordSources = {
      list: LIST_SOURCE,
      meaning: meaningSource(gloss.origin),
      phonetic: gloss.phonetic ? meaningSource(gloss.origin) : item.sources?.phonetic || 'ecdict',
      englishMeaning: meaningSource(gloss.origin),
      example: meaningSource(gloss.origin)
    }
    const tags = (item.tags || []).filter(tag => !tag.startsWith('src:'))
    return {
      ...item,
      word,
      meaning: gloss.meaning,
      englishMeaning: gloss.englishMeaning,
      phonetic: gloss.phonetic || item.phonetic,
      exampleSentence: gloss.exampleSentence,
      senseKey: item.senseKey || '',
      senseLabel: item.senseLabel || '',
      sources,
      tags: [...new Set([...tags, ...sourceTags(sources)])]
    }
  })

  book.wordCount = book.words.length
  fs.writeFileSync(BOOK_PATH, `${JSON.stringify(book, null, 2)}\n`)

  const glossOut: Record<string, KewGloss> = {}
  for (const [word, gloss] of Object.entries(glosses)) {
    glossOut[word] = {
      meaning: gloss.meaning,
      englishMeaning: gloss.englishMeaning,
      phonetic: gloss.phonetic,
      exampleSentence: gloss.exampleSentence,
      ...(gloss.exampleSentences?.length ? { exampleSentences: gloss.exampleSentences } : {})
    }
  }
  writeNormalizedGlosses(GLOSS_PATH, glossOut)

  console.log(`中考词汇: ${book.words.length} 词`)
  console.log(`  KEW 1200: ${byOrigin.kew1200}`)
  console.log(`  KEW 4500: ${byOrigin.kew4500}`)
  console.log(`  中考补写: ${byOrigin['editor-zhongkao']}`)
  console.log(`  仍缺: ${missing.length}`)
  if (missing.length) {
    console.log(`  缺词: ${missing.join(', ')}`)
  }
  console.log(`义项表: ${GLOSS_PATH}`)
}

polishBook()
