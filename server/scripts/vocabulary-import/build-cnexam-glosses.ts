#!/usr/bin/env ts-node
/**
 * 重建高考 / CET-4 / CET-6 的 glosses.json。
 * 词表以已有 gloss 为准（不再读 txt）；优先复用中考与 KEW 已校对释义。
 */
import fs from 'fs'
import path from 'path'
import { loadEcdictCsv, ecdictToKyleBingMap } from './parse-ecdict'
import { loadNormalizedGlosses, writeNormalizedGlosses, type KewGloss } from './kew-gloss'
import { makeExampleSentence, exampleContainsWord } from './book-word'
import { sourceTags } from './book-word'
import type { WordData, WordSources } from '../../src/data/vocabulary/types'
import {
  cnexamBookPath,
  cnexamGlossPath,
  type CnexamBook
} from './cnexam-layout'
import { KEW_ROOT } from './kew-layout'

const ROOT = path.join(__dirname, '../..')
const SOURCES = path.join(ROOT, 'data/sources')

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}

function shortenChinese(text: string): string {
  const first = text.split(/[；;，,]/)[0]?.trim() || text
  const cleaned = first.replace(/（[^）]*）|\([^)]*\)/g, '').trim()
  return (cleaned || first).slice(0, 12)
}

function isGoodEnglish(text: string): boolean {
  if (!text || hasChinese(text) || text.includes('[待校对]') || text.startsWith('a listed')) return false
  const trimmed = text.trim()
  return trimmed.length >= 8 && trimmed.length <= 70
}

function isGoodExample(word: string, example: string): boolean {
  if (!example) return false
  if (example.startsWith('Students study the word')) return false
  const count = example.trim().split(/\s+/).length
  return count >= 4 && count <= 16 && exampleContainsWord(word, example)
}

function loadGlossFile(file: string): Record<string, KewGloss> {
  return loadNormalizedGlosses(file)
}

function loadKew(series: 'kew1200' | 'kew4500' | 'kew7200', count: number): Record<string, KewGloss> {
  const map: Record<string, KewGloss> = {}
  for (let i = 1; i <= count; i++) {
    Object.assign(map, loadGlossFile(path.join(KEW_ROOT, series, `${series}-${i}-glosses.json`)))
  }
  return map
}

function guessPos(entry: { meaning?: string; englishMeaning?: string }): string {
  const en = entry.englishMeaning || ''
  if (/^to /.test(en)) return 'v'
  const meaning = entry.meaning || ''
  if (meaning.endsWith('的')) return 'adj'
  if (meaning.endsWith('地')) return 'adv'
  return 'n'
}

function fromDict(
  word: string,
  existing: KewGloss | undefined,
  dict?: { meaning?: string; phonetic?: string; englishMeaning?: string }
): KewGloss {
  const meaning = shortenChinese(existing?.meaning || dict?.meaning || word)
  let english = ''
  if (isGoodEnglish(dict?.englishMeaning || '')) english = (dict?.englishMeaning || '').split(/[.;]/)[0].trim()
  else if (isGoodEnglish(existing?.englishMeaning || '')) english = (existing?.englishMeaning || '').split(/[.;]/)[0].trim()
  else english = `a useful English word: ${word}`
  const phonetic = dict?.phonetic || existing?.phonetic || `/${word}/`
  const pos = existing || dict ? guessPos(existing || dict || {}) : ''
  let example = existing && isGoodExample(word, existing.exampleSentence)
    ? existing.exampleSentence
    : makeExampleSentence(word, pos)
  if (!isGoodExample(word, example)) example = `We use the word ${word} in class.`
  return {
    meaning: hasChinese(meaning) ? meaning : `[待校对] ${word}`,
    englishMeaning: english.slice(0, 70),
    phonetic: phonetic.startsWith('/') ? phonetic : `/${phonetic}/`,
    exampleSentence: example
  }
}

function pickGloss(
  word: string,
  layers: Array<Record<string, KewGloss>>,
  existing?: KewGloss,
  dict?: { meaning?: string; phonetic?: string; englishMeaning?: string },
  book?: WordData
): KewGloss {
  for (const layer of layers) {
    const hit = layer[word]
    if (hit?.meaning && hit.englishMeaning && hit.exampleSentence) return hit
  }
  if (book && hasChinese(book.meaning) && isGoodEnglish(book.englishMeaning || '') && isGoodExample(word, book.exampleSentence || '')) {
    return {
      meaning: shortenChinese(book.meaning),
      englishMeaning: book.englishMeaning,
      phonetic: book.phonetic,
      exampleSentence: book.exampleSentence || makeExampleSentence(word)
    }
  }
  const drafted = fromDict(word, existing, dict)
  if (book) {
    if (hasChinese(book.meaning) && !book.meaning.includes('[待校对]')) drafted.meaning = shortenChinese(book.meaning)
    if (book.phonetic && book.phonetic !== `/${word}/`) drafted.phonetic = book.phonetic
    if (isGoodEnglish(book.englishMeaning || '')) drafted.englishMeaning = book.englishMeaning
    if (isGoodExample(word, book.exampleSentence || '')) drafted.exampleSentence = book.exampleSentence as string
  }
  return drafted
}

function requireGlosses(code: CnexamBook): Record<string, KewGloss> {
  const file = cnexamGlossPath(code)
  if (!fs.existsSync(file)) {
    throw new Error(`缺少 ${file}，词表已改由 glosses.json 维护`)
  }
  return loadGlossFile(file)
}

function writeGlosses(code: CnexamBook, byWord: Record<string, KewGloss>) {
  const file = cnexamGlossPath(code)
  writeNormalizedGlosses(file, byWord)
  return file
}

function applyToBook(code: 'gaokao', byWord: Record<string, KewGloss>) {
  const bookPath = cnexamBookPath(code)
  if (!fs.existsSync(bookPath)) return
  const book = JSON.parse(fs.readFileSync(bookPath, 'utf-8')) as { words: WordData[]; [key: string]: unknown }
  book.words = book.words.map(item => {
    const word = item.word.toLowerCase()
    const gloss = byWord[word]
    if (!gloss) return item
    const sources: WordSources = {
      list: 'kylebing-senior',
      meaning: 'editor-cnexam',
      phonetic: gloss.phonetic ? 'editor-cnexam' : item.sources?.phonetic || 'ecdict',
      englishMeaning: 'editor-cnexam',
      example: 'editor-cnexam'
    }
    const tags = (item.tags || []).filter(tag => !tag.startsWith('src:'))
    return {
      ...item,
      word,
      meaning: gloss.meaning,
      englishMeaning: gloss.englishMeaning,
      phonetic: gloss.phonetic || item.phonetic,
      exampleSentence: gloss.exampleSentence,
      sources,
      tags: [...new Set([...tags, ...sourceTags(sources)])]
    }
  })
  book.wordCount = book.words.length
  fs.writeFileSync(bookPath, `${JSON.stringify(book, null, 2)}\n`)
  console.log(`  已写入成品 ${bookPath}`)
}

async function main() {
  const zhongkao = loadGlossFile(cnexamGlossPath('zhongkao'))
  const kew1200 = loadKew('kew1200', 3)
  const kew4500 = loadKew('kew4500', 4)
  const kew7200 = loadKew('kew7200', 3)
  const shared = [zhongkao, kew1200, kew4500, kew7200]

  const existingGaokao = requireGlosses('gaokao')
  const existingCet4 = requireGlosses('cet4')
  const existingCet6 = requireGlosses('cet6')

  const gaokaoBook = JSON.parse(fs.readFileSync(cnexamBookPath('gaokao'), 'utf-8')) as { words: WordData[] }
  const gaokaoByWord = Object.fromEntries(gaokaoBook.words.map(item => [item.word.toLowerCase(), item]))

  console.log('加载 ECDICT...')
  const dict = new Map(ecdictToKyleBingMap(await loadEcdictCsv(path.join(SOURCES, 'ecdict.csv'))))

  const gaokaoWords = [...new Set([...Object.keys(existingGaokao), ...Object.keys(gaokaoByWord)])]
  const gaokaoGloss: Record<string, KewGloss> = {}
  for (const word of gaokaoWords) {
    gaokaoGloss[word] = pickGloss(word, shared, existingGaokao[word], dict.get(word), gaokaoByWord[word])
  }
  console.log(`高考 glosses: ${Object.keys(gaokaoGloss).length} → ${writeGlosses('gaokao', gaokaoGloss)}`)
  applyToBook('gaokao', gaokaoGloss)

  const cet4Gloss: Record<string, KewGloss> = {}
  for (const word of Object.keys(existingCet4)) {
    cet4Gloss[word] = pickGloss(word, [gaokaoGloss, ...shared], existingCet4[word], dict.get(word))
  }
  console.log(`四级 glosses: ${Object.keys(cet4Gloss).length} → ${writeGlosses('cet4', cet4Gloss)}`)

  const cet6Gloss: Record<string, KewGloss> = {}
  for (const word of Object.keys(existingCet6)) {
    cet6Gloss[word] = pickGloss(word, [cet4Gloss, gaokaoGloss, ...shared], existingCet6[word], dict.get(word))
  }
  console.log(`六级 glosses: ${Object.keys(cet6Gloss).length} → ${writeGlosses('cet6', cet6Gloss)}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
