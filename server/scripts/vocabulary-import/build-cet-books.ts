#!/usr/bin/env ts-node
/**
 * 从 cnexam glosses 生成 CET-4 / CET-6 成品词书，并写入 books/。
 *
 *   npm run build:cet-books
 *   然后: npm run enrich:atlas
 */
import fs from 'fs'
import type { WordData, WordSources } from '../../src/data/vocabulary/types'
import { resolveWordTaxonomy } from '../../src/data/taxonomy/word-tags'
import { normalizeTopic } from '../../src/data/taxonomy'
import { cnexamBookPath, cnexamGlossPath, loadCnexamGlosses, type CnexamBook } from './cnexam-layout'
import { sourceTags } from './book-word'
import { ensureBasicExample } from './enrich-from-atlas'

const META: Record<'cet4' | 'cet6', { name: string; description: string; level: string }> = {
  cet4: {
    name: '大学英语四级',
    description: '大学英语四级词汇（cnexam gloss 成品）',
    level: 'CET-4'
  },
  cet6: {
    name: '大学英语六级',
    description: '大学英语六级词汇（cnexam gloss 成品）',
    level: 'CET-6'
  }
}

function buildOne(code: 'cet4' | 'cet6') {
  const glosses = loadCnexamGlosses(code as CnexamBook)
  const words: WordData[] = Object.keys(glosses)
    .sort((a, b) => a.localeCompare(b))
    .map(key => {
      const gloss = glosses[key]
      const taxonomy = resolveWordTaxonomy(key)
      const sources: WordSources = {
        list: `cnexam-${code}`,
        meaning: 'editor-cnexam',
        phonetic: gloss.phonetic ? 'editor-cnexam' : 'pending',
        englishMeaning: 'editor-cnexam',
        example: 'editor-cnexam'
      }
      const word: WordData = {
        word: key,
        meaning: gloss.meaning,
        phonetic: gloss.phonetic || `/${key}/`,
        englishMeaning: gloss.englishMeaning,
        exampleSentence: gloss.exampleSentence,
        contentType: taxonomy.contentType,
        topic: normalizeTopic(taxonomy.topic),
        topics: [normalizeTopic(taxonomy.topic)],
        tags: [...sourceTags(sources), ...(taxonomy.tags || [])],
        senseKey: '',
        senseLabel: '',
        sources
      }
      ensureBasicExample(word)
      return word
    })

  const book = {
    code,
    name: META[code].name,
    description: META[code].description,
    level: META[code].level,
    targetWordCount: words.length,
    source: `cnexam-${code}`,
    wordCount: words.length,
    words
  }

  const out = cnexamBookPath(code)
  fs.writeFileSync(out, `${JSON.stringify(book, null, 2)}\n`)
  console.log(`${code}: ${words.length} 词 → ${out}`)
}

function main() {
  buildOne('cet4')
  buildOne('cet6')
}

if (require.main === module) {
  main()
}
