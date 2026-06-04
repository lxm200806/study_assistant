import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { loadEcdictCsv, ecdictToKyleBingMap } from './vocabulary-import/parse-ecdict'
import { parseKyleBingTxt } from './vocabulary-import/parse-kylebing'
import { loadEnCache, saveEnCache } from './vocabulary-import/enrich'
import { resolveMissingMeaning } from './vocabulary-import/meaning-lookup'
import { isMissingMeaning } from '../src/utils/vocabulary-meaning'

dotenv.config()

const ROOT = path.join(__dirname, '..')
const BOOKS_DIR = path.join(ROOT, 'data/vocabulary/books')
const SOURCES = path.join(ROOT, 'data/sources')

interface BookJson {
  code: string
  name: string
  words: Array<{
    word: string
    meaning: string
    phonetic?: string
    englishMeaning?: string
    emoji?: string
    contentType?: string
    topic?: string
    tags?: string[]
  }>
}

async function buildCnLookup() {
  const ecdict = await loadEcdictCsv(path.join(SOURCES, 'ecdict.csv'))
  const files = ['cet4.txt', 'cet6.txt', 'toefl.txt', 'zhongkao.txt', 'gaokao.txt']
  const maps = [
    ...ecdictToKyleBingMap(ecdict),
    ...files.flatMap(f => {
      const p = path.join(SOURCES, f)
      return fs.existsSync(p) ? [...parseKyleBingTxt(fs.readFileSync(p, 'utf-8'))] : []
    })
  ]
  return new Map(maps)
}

async function main() {
  loadEnCache()
  const cnLookup = await buildCnLookup()
  const cache: Record<string, { phonetic?: string; definition?: string; failed?: boolean }> = {}

  const bookFiles = fs.readdirSync(BOOKS_DIR).filter(f => f.endsWith('.json') && f !== 'build-report.json')
  let filled = 0
  let stillMissing = 0

  for (const file of bookFiles) {
    const filePath = path.join(BOOKS_DIR, file)
    const book = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as BookJson
    let changed = false

    for (const entry of book.words) {
      if (!isMissingMeaning(entry.meaning, entry.englishMeaning)) continue

      console.log(`查词: ${entry.word} (${book.name})`)
      const resolved = await resolveMissingMeaning(entry.word, cnLookup, cache)
      if (!resolved || resolved.meaning.startsWith('[待校对]')) {
        stillMissing++
        console.log(`  ✗ 未能补全`)
        continue
      }

      entry.meaning = resolved.meaning
      entry.englishMeaning = resolved.englishMeaning
      if (resolved.phonetic) entry.phonetic = resolved.phonetic
      filled++
      changed = true
      console.log(`  ✓ ${resolved.meaning}  [${resolved.source}]`)
    }

    if (changed) {
      fs.writeFileSync(filePath, JSON.stringify(book, null, 0))
      console.log(`已更新 ${file}`)
    }
  }

  saveEnCache()
  console.log(`\n补全完成: ${filled} 成功, ${stillMissing} 仍缺释义`)

  if (filled > 0) {
    console.log('正在同步到数据库...')
    const { initBooks } = await import('../src/services/book.service')
    await initBooks()
    console.log('✓ 数据库已同步')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
