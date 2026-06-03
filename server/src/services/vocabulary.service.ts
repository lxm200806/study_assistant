import prisma from '../prisma/client'
import { WordType } from '../types'

export async function getVocabulary(page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit
  
  return prisma.vocabulary.findMany({
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' }
  })
}

export async function getVocabularyById(id: string) {
  return prisma.vocabulary.findUnique({
    where: { id }
  })
}

export async function getRandomVocabulary(count: number = 10) {
  const allWords = await prisma.vocabulary.findMany()
  const shuffled = allWords.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export async function getVocabularyStats(userId: string, type?: WordType) {
  const where: any = { userId }
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
    where: { userId },
    select: { type: true, practiceCount: true, mastery: true }
  })
  
  const result: any = {
    listening: { total: 0, mastered: 0 },
    speaking: { total: 0, mastered: 0 },
    reading: { total: 0, mastered: 0 },
    writing: { total: 0, mastered: 0 }
  }
  
  const typeStats: Record<string, { count: number; totalMastery: number }> = {
    listening: { count: 0, totalMastery: 0 },
    speaking: { count: 0, totalMastery: 0 },
    reading: { count: 0, totalMastery: 0 },
    writing: { count: 0, totalMastery: 0 }
  }
  
  stats.forEach((stat) => {
    const type = stat.type as WordType
    if (typeStats[type]) {
      typeStats[type].count++
      typeStats[type].totalMastery += stat.mastery
    }
  })
  
  Object.keys(result).forEach((key) => {
    const type = key as WordType
    if (typeStats[type]) {
      result[type].total = typeStats[type].count
      result[type].mastered = typeStats[type].count > 0 
        ? Math.round(typeStats[type].totalMastery / typeStats[type].count) 
        : 0
    }
  })
  
  return result
}