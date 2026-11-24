import prisma from '../prisma/client'
import { WordType } from '../types'

function visibleWordWhere(learnerId?: string) {
  return {
    OR: [{ ownerLearnerId: null }, ...(learnerId ? [{ ownerLearnerId: learnerId }] : [])]
  }
}

export async function getVocabulary(page: number = 1, limit: number = 20, learnerId?: string) {
  const skip = (page - 1) * limit

  return prisma.vocabulary.findMany({
    where: visibleWordWhere(learnerId),
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' }
  })
}

export async function getVocabularyById(id: string, learnerId?: string) {
  return prisma.vocabulary.findFirst({
    where: { id, ...visibleWordWhere(learnerId) }
  })
}

export async function getRandomVocabulary(count: number = 10, learnerId?: string) {
  const allWords = await prisma.vocabulary.findMany({
    where: visibleWordWhere(learnerId)
  })
  const shuffled = allWords.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export async function getVocabularyStats(userId: string, type?: WordType) {
  const where: any = { learnerId: userId }
  if (type) {
    where.type = type
  }
  
  return prisma.vocabularyStat.findMany({
    where,
    include: { word: true }
  })
}

export async function getTrainingStats(userId: string) {
  const stats = await prisma.vocabularyStat.findMany({
    where: { learnerId: userId },
    select: { type: true, practiceCount: true, mastery: true }
  })

  const result: Record<string, { total: number; mastered: number; avgMastery: number }> = {
    listening: { total: 0, mastered: 0, avgMastery: 0 },
    speaking: { total: 0, mastered: 0, avgMastery: 0 },
    reading: { total: 0, mastered: 0, avgMastery: 0 },
    writing: { total: 0, mastered: 0, avgMastery: 0 }
  }

  for (const key of Object.keys(result)) {
    const typeStats = stats.filter(s => s.type === key)
    const total = typeStats.length
    const mastered = typeStats.filter(s => s.mastery >= 4).length
    const avgMastery = total > 0
      ? Math.round(typeStats.reduce((sum, s) => sum + s.mastery, 0) / total)
      : 0
    result[key] = { total, mastered, avgMastery }
  }

  return result
}
