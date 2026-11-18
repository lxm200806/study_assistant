#!/usr/bin/env ts-node
/**
 * 按需同步成品词书到数据库（不阻塞 API 启动）。
 *
 *   npm run tongbu:cishu
 *   npm run tongbu:cishu -- cet4 cet6
 *   npm run tongbu:cishu -- --force kew1200   # 校对释义后强制重写库
 */
import 'dotenv/config'
import { initBooks } from '../src/services/book.service'

async function main() {
  const raw = process.argv.slice(2).filter(a => !a.endsWith('.ts'))
  const force = raw.includes('--force')
  const args = raw.filter(a => !a.startsWith('-'))
  console.log(`同步词书: ${args.length ? args.join(', ') : '全部注册书'}${force ? ' (force)' : ''}`)
  await initBooks(args.length ? args : undefined, { force })
  console.log('完成')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
