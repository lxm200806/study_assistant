#!/usr/bin/env ts-node
/**
 * 将 cishu:daochu 产出的 delta.jsonl 合并进 senses.json。
 * - missing：新建 pending
 * - fill：只补空字段（llm/verified 也不覆盖已有非空值）
 * - unresolved 不自动合并
 *
 *   npm run cidian:hebing -- --book kew1200 --dry-run
 *   npm run cidian:hebing -- --book kew1200
 *   npm run cidian:hebing -- --from tmp/lexicon-from-books/kew1200/delta.jsonl
 */
import path from 'path'
import {
  bookExportDir,
  mergeDeltaFile,
  sensesFilePath
} from './book-lexicon-delta'
import { SERVER_ROOT } from './book-lexicon-paths'

function main() {
  const args = process.argv.slice(2).filter(a => !a.endsWith('.ts'))
  const dryRun = args.includes('--dry-run')
  const fromIdx = args.indexOf('--from')
  const bookIdx = args.indexOf('--book')

  let deltaPath = ''
  if (fromIdx >= 0) {
    const raw = args[fromIdx + 1]
    if (!raw) throw new Error('--from 需要路径')
    deltaPath = path.isAbsolute(raw) ? raw : path.join(SERVER_ROOT, raw)
  } else if (bookIdx >= 0) {
    const book = args[bookIdx + 1]
    if (!book) throw new Error('--book 需要书号，如 kew1200')
    deltaPath = path.join(bookExportDir(book), 'delta.jsonl')
  } else {
    console.error('用法: npm run cidian:hebing -- --book kew1200 [--dry-run]')
    console.error('  或: npm run cidian:hebing -- --from tmp/lexicon-from-books/kew1200/delta.jsonl')
    process.exit(1)
  }

  const result = mergeDeltaFile(deltaPath, { dryRun })
  console.log(
    `${dryRun ? '[dry-run] ' : ''}合并 ${deltaPath}\n  新增 ${result.added} | 补洞 ${result.filled} | 跳过 ${result.skipped}`
  )
  if (!dryRun && (result.added || result.filled)) {
    console.log(`已写入 ${sensesFilePath()}`)
    console.log('新 pending 可跑: npm run cidian:jiaoyan -- --llm --concurrency 8')
  }
}

main()
