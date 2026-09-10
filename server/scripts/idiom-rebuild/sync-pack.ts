import prisma from '../../src/prisma/client'
import { IDIOM_PACK, syncPack } from '../../src/chinese/materials'

async function main() {
  const result = await syncPack(IDIOM_PACK, true)
  if (!result.resourceId) throw new Error('成语资源同步后没有 resourceId')
  console.log(JSON.stringify({ ...result, preservedExistingCourses: true }, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
