import prisma from '../prisma/client'
import { addDaysToKey, todayKey } from '../utils/date-key'

export async function recordDailyStudy(userId: string, wordCount: number) {
  const today = todayKey()
  const existing = await prisma.dailyStudyLog.findUnique({
    where: { learnerId_date: { learnerId: userId, date: today } }
  })

  if (existing) {
    return prisma.dailyStudyLog.update({
      where: { id: existing.id },
      data: { wordCount: existing.wordCount + wordCount }
    })
  }

  const yesterday = addDaysToKey(today, -1)
  const prev = await prisma.dailyStudyLog.findUnique({
    where: { learnerId_date: { learnerId: userId, date: yesterday } }
  })

  const streak = prev && prev.wordCount > 0 ? prev.streak + 1 : 1

  return prisma.dailyStudyLog.create({
    data: { learnerId: userId, date: today, wordCount, streak }
  })
}

export async function getDailyStats(userId: string) {
  const today = todayKey()
  const todayLog = await prisma.dailyStudyLog.findUnique({
    where: { learnerId_date: { learnerId: userId, date: today } }
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
    where: { learnerId: userId },
    orderBy: { date: 'desc' },
    take: 60
  })
  let streak = 0
  let expect = todayKey()
  for (const log of logs) {
    if (log.date !== expect || log.wordCount <= 0) break
    streak++
    expect = addDaysToKey(expect, -1)
  }
  return streak
}

export async function getWeeklyReport(userId: string) {
  const since = addDaysToKey(todayKey(), -7)
  const logs = await prisma.dailyStudyLog.findMany({
    where: { learnerId: userId, date: { gte: since } },
    orderBy: { date: 'asc' }
  })

  const totalWords = logs.reduce((s, l) => s + l.wordCount, 0)
  const activeDays = logs.filter(l => l.wordCount > 0).length
  const streak = logs.length ? logs[logs.length - 1].streak : 0

  const records = await prisma.trainingRecord.findMany({
    where: { learnerId: userId, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }
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
