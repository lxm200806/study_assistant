#!/usr/bin/env ts-node
/**
 * 把成品词书瘦成课表形态：只保留顺序、word、单元标记、多义词选义。
 * 释义/音标/例句等以 senses.json 为准（同步时 hydrate）。
 *
 * 瘦身前备份胖书到 tmp/lexicon-from-books/<code>/book-fat-backup.json
 *
 *   npm run cishu:shoushen -- kew1200
 *   npm run cishu:shoushen -- kew1200 --dry-run
 *   npm run cishu:shoushen              # 默认三本 KEW
 */
import fs from 'fs'
import path from 'path'
import type { BookData, WordData } from '../../src/data/vocabulary/types'
import { BOOKS_DIR, TMP_DIR, VOCABULARY_BOOK_CODES_HINT } from './book-lexicon-paths'

const KEEP_TAG_PREFIXES = ['kew-unit:', 'unit:', 'lesson:', 'sense:', 'src:list=']
const DEFAULT_CODES = ['kew1200', 'kew4500', 'kew7200']

function curriculumTags(tags: string[] | undefined): string[] {
  return [...new Set((tags || []).filter(t => KEEP_TAG_PREFIXES.some(p => t.startsWith(p))))]
}

export function slimWord(item: WordData): WordData {
  const out: WordData = {
    word: item.word.trim().toLowerCase()
  }
  if (item.senseKey?.trim()) out.senseKey = item.senseKey.trim()
  if (item.senseLabel?.trim()) out.senseLabel = item.senseLabel.trim()
  if (item.emoji?.trim()) out.emoji = item.emoji.trim()
  const tags = curriculumTags(item.tags)
  if (tags.length) out.tags = tags
  return out
}

function resolveTargets(argv: string[]): string[] {
  const codes = argv.filter(a => !a.startsWith('--') && !a.endsWith('.ts'))
  if (!codes.length) return DEFAULT_CODES
  return codes
}

function slimBookFile(code: string, dryRun: boolean) {
  const bookPath = path.join(BOOKS_DIR, `${code}.json`)
  if (!fs.existsSync(bookPath)) throw new Error(`缺少成品书: ${bookPath}`)
  const book = JSON.parse(fs.readFileSync(bookPath, 'utf-8')) as BookData & {
    wordCount?: number
    words: WordData[]
  }

  const backupDir = path.join(TMP_DIR, 'lexicon-from-books', code)
  fs.mkdirSync(backupDir, { recursive: true })
  const backupPath = path.join(backupDir, 'book-fat-backup.json')

  const slimmed = book.words.map(slimWord)
  const next = {
    ...book,
    words: slimmed,
    wordCount: slimmed.length
  }

  if (dryRun) {
    console.log(
      `[dry-run] ${code}: ${book.words.length} 词 → 示例 ${JSON.stringify(slimmed[0] || {})}`
    )
    return
  }

  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, `${JSON.stringify(book, null, 2)}\n`)
    console.log(`备份胖书 → ${backupPath}`)
  } else {
    console.log(`已有备份，跳过覆盖: ${backupPath}`)
  }

  fs.writeFileSync(bookPath, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`已瘦身 ${code}: ${slimmed.length} 词 → ${bookPath}`)
}

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const targets = resolveTargets(args)
  console.log(`${dryRun ? '[dry-run] ' : ''}瘦身词书: ${targets.join(', ')}`)
  console.log(`（其它书请显式传 code；可用: ${VOCABULARY_BOOK_CODES_HINT}）`)
  for (const code of targets) {
    slimBookFile(code, dryRun)
  }
  if (!dryRun) {
    console.log('\n下一步: npm run tongbu:cishu -- --force kew1200')
  }
}

main()
