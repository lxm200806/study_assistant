import prisma from '../prisma/client'
import { PracticeDto, WordType } from '../types'
import { calculateMastery } from '../utils/mastery'

export async function practice(userId: string, dto: PracticeDto) {
  const existingStat = await prisma.vocabularyStat.findUnique({
    where: {
      userId_wordId_type: {
        userId,
        wordId: dto.wordId,
        type: dto.type
      }
    }
  })
  
  let updatedStat
  
  if (existingStat) {
    const newPracticeCount = existingStat.practiceCount + 1
    const newCorrectCount = existingStat.correctCount + (dto.isCorrect ? 1 : 0)
    const newMastery = calculateMastery(newPracticeCount, newCorrectCount, new Date())
    
    updatedStat = await prisma.vocabularyStat.update({
      where: { id: existingStat.id },
      data: {
        practiceCount: newPracticeCount,
        correctCount: newCorrectCount,
        lastPractice: new Date(),
        mastery: newMastery
      },
      include: { word: true }
    })
  } else {
    const newMastery = calculateMastery(1, dto.isCorrect ? 1 : 0, new Date())
    
    updatedStat = await prisma.vocabularyStat.create({
      data: {
        userId,
        wordId: dto.wordId,
        type: dto.type,
        practiceCount: 1,
        correctCount: dto.isCorrect ? 1 : 0,
        lastPractice: new Date(),
        mastery: newMastery
      },
      include: { word: true }
    })
  }
  
  await prisma.trainingRecord.create({
    data: {
      userId,
      wordId: dto.wordId,
      type: dto.type,
      isCorrect: dto.isCorrect
    }
  })
  
  return updatedStat
}

export async function getReviewWords(userId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  
  const stats = await prisma.vocabularyStat.findMany({
    where: {
      userId,
      OR: [
        { lastPractice: { lt: sevenDaysAgo } },
        { lastPractice: null }
      ]
    },
    include: { word: true },
    orderBy: { lastPractice: 'asc' }
  })
  
  return stats
}

export async function getTrainingHistory(userId: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit
  
  return prisma.trainingRecord.findMany({
    where: { userId },
    include: { word: true },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit
  })
}