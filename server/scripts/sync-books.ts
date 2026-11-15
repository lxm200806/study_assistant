#!/usr/bin/env ts-node
/**
 * 按需同步成品词书到数据库（不阻塞 API 启动）。
 *
 *   npm run sync:books
 *   npm run sync:books -- cet4 cet6
 */
import 'dotenv/config'
import { VOCABULARY_BOOK_CODES } from '../src/data/vocabulary'
import { syncBookByCode } from '../src/services/book.service'

async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('-') && !a.endsWith('.ts'))
  const codes = args.length ? args : [...VOCABULARY_BOOK_CODES]
  console.log(`同步词书: ${codes.join(', ')}`)
  for (const code of codes) {
    await syncBookByCode(code)
  }
  console.log('完成')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
