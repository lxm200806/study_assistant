import fs from 'fs'
import path from 'path'
import prisma from '../../src/prisma/client'
import { chineseRawRoot, IDIOM_PACK, syncPack } from '../../src/chinese/materials'

async function main() {
  const rawPath = path.join(chineseRawRoot(), 'idioms', IDIOM_PACK.jsonName)
  const pack = JSON.parse(fs.readFileSync(rawPath, 'utf8')) as { points?: Array<{ key?: string }> }
  const activeKeys = (pack.points || []).map(point => String(point.key || '')).filter(Boolean)
  const result = await syncPack(IDIOM_PACK, true)
  if (!result.resourceId) throw new Error('成语资源同步后没有 resourceId')

  // 重建后已取消的初中释义题必须从发布库移除，否则默认课程下一次同步会重新纳入。
  const stale = await prisma.chinesePublished.findMany({
    where: {
      sourceResourceId: result.resourceId,
      pointKey: { notIn: activeKeys }
    },
    select: { id: true, pointKey: true }
  })
  const staleIds = stale.map(row => row.id)
  if (staleIds.length) {
    await prisma.$transaction([
      prisma.chineseReviewLog.deleteMany({ where: { pointId: { in: staleIds } } }),
      prisma.chineseReviewState.deleteMany({ where: { pointId: { in: staleIds } } }),
      prisma.chineseCourseItem.deleteMany({ where: { pointId: { in: staleIds } } }),
      prisma.chinesePublished.deleteMany({ where: { id: { in: staleIds } } })
    ])
  }
  console.log(JSON.stringify({
    ...result,
    removedStaleCards: stale.length
  }, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
