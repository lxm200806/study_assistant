import 'dotenv/config'
import prisma from '../src/prisma/client'
import { initVocabulary } from '../src/utils/seed'
import { initBooks } from '../src/services/book.service'
import { seedChineseIfEmpty } from '../src/chinese/materials'

/**
 * 独立内容同步：
 *   cd server && npm run content:sync
 * 多实例部署时可作为一次性 job 运行，避免每个 API 实例启动时重复同步。
 */
async function main() {
  console.log('→ syncing vocabulary…')
  await initVocabulary()

  console.log('→ syncing books…')
  const books = await initBooks()
  if (books.failures.length) {
    console.warn('book sync failures:', books.failures)
  }

  console.log('→ seeding Chinese resources…')
  await seedChineseIfEmpty()

  console.log('✓ content sync complete')
  await prisma.$disconnect()
}

main().catch(async error => {
  console.error('content sync failed:', error)
  await prisma.$disconnect()
  process.exit(1)
})
