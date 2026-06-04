import prisma from '../prisma/client'

function dateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export async function recordDailyStudy(userId: string, wordCount: number) {
  const today = dateKey()
  const existing = await prisma.dailyStudyLog.findUnique({
    where: { userId_date: { userId, date: today } }
  })

  if (existing) {
    return prisma.dailyStudyLog.update({
      where: { id: existing.id },
      data: { wordCount: existing.wordCount + wordCount }
    })
  }

  const yesterday = dateKey(new Date(Date.now() - 86400000))
  const prev = await prisma.dailyStudyLog.findUnique({
    where: { userId_date: { userId, date: yesterday } }
  })

  const streak = prev && prev.wordCount > 0 ? prev.streak + 1 : 1

  return prisma.dailyStudyLog.create({
    data: { userId, date: today, wordCount, streak }
  })
}

export async function getDailyStats(userId: string) {
  const today = dateKey()
  const todayLog = await prisma.dailyStudyLog.findUnique({
    where: { userId_date: { userId, date: today } }
  })

  const goal = 30
  const wordCount = todayLog?.wordCount || 0
  const streak = todayLog?.streak || await computeStreak(userId)

  return {
    date: today,
    wordCount,
    goal,
    streak,
    progress: Math.min(100, Math.round((wordCount / goal) * 100))
  }
}

async function computeStreak(userId: string): Promise<number> {
  const logs = await prisma.dailyStudyLog.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 60
  })
  let streak = 0
  let expect = dateKey()
  for (const log of logs) {
    if (log.date !== expect || log.wordCount <= 0) break
    streak++
    const d = new Date(expect)
    d.setDate(d.getDate() - 1)
    expect = dateKey(d)
  }
  return streak
}

export async function getWeeklyReport(userId: string) {
  const since = dateKey(new Date(Date.now() - 7 * 86400000))
  const logs = await prisma.dailyStudyLog.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: 'asc' }
  })

  const totalWords = logs.reduce((s, l) => s + l.wordCount, 0)
  const activeDays = logs.filter(l => l.wordCount > 0).length
  const streak = logs.length ? logs[logs.length - 1].streak : 0

  const records = await prisma.trainingRecord.findMany({
    where: { userId, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }
  })
  const correct = records.filter(r => r.isCorrect).length
  const accuracy = records.length ? Math.round((correct / records.length) * 100) : 0

  return {
    totalWords,
    activeDays,
    streak,
    accuracy,
    practiceCount: records.length
  }
}
