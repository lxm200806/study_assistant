import prisma from '../prisma/client'
import { comparePassword } from '../utils/password'

/** 导出账号及其全部学习数据。 */
export async function exportAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      isAdmin: true,
      plan: true,
      planExpiresAt: true,
      hasOnboarded: true,
      activeSubject: true,
      activeRole: true,
      createdAt: true
    }
  })
  if (!user) throw new Error('User not found')

  const learners = await prisma.learner.findMany({
    where: { accountId: userId },
    orderBy: { createdAt: 'asc' }
  })
  const learnerIds = learners.map(learner => learner.id)

  const [
    unlocks,
    vocabularyStats,
    trainingRecords,
    dailyLogs,
    chatRecords,
    speechLogs,
    chineseCourses,
    chineseReviews
  ] = await Promise.all([
    prisma.userBookUnlock.findMany({
      where: { userId },
      include: { book: { select: { code: true, name: true } } }
    }),
    prisma.vocabularyStat.findMany({ where: { learnerId: { in: learnerIds } } }),
    prisma.trainingRecord.findMany({
      where: { learnerId: { in: learnerIds } },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.dailyStudyLog.findMany({
      where: { learnerId: { in: learnerIds } },
      orderBy: { date: 'asc' }
    }),
    prisma.chatRecord.findMany({
      where: { learnerId: { in: learnerIds } },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.speechUsageLog.findMany({
      where: { learnerId: { in: learnerIds } },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.chineseCourse.findMany({
      where: { learnerId: { in: learnerIds } },
      include: { items: true }
    }),
    prisma.chineseReviewLog.findMany({
      where: { learnerId: { in: learnerIds } },
      orderBy: { createdAt: 'asc' }
    })
  ])

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    user,
    learners,
    unlocks,
    vocabularyStats,
    trainingRecords,
    dailyLogs,
    chatRecords,
    speechLogs,
    chineseCourses,
    chineseReviews
  }
}

/** 校验密码后删除账号；Learner 及其学习数据由外键级联删除。 */
export async function deleteAccount(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) throw new Error('密码不正确')
  await prisma.user.delete({ where: { id: userId } })
}
