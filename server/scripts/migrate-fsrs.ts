import prisma from '../src/prisma/client'
import {
  replayPracticeHistory,
  initializeFromAggregates,
  buildFsrsFieldsFromStat
} from '../src/services/review-engine.service'

async function main() {
  console.log('Starting FSRS migration...')

  const stats = await prisma.vocabularyStat.findMany({
    orderBy: [{ userId: 'asc' }, { wordId: 'asc' }, { type: 'asc' }]
  })

  let migrated = 0
  for (const stat of stats) {
    const records = await prisma.trainingRecord.findMany({
      where: {
        userId: stat.userId,
        wordId: stat.wordId,
        type: stat.type
      },
      orderBy: { createdAt: 'asc' },
      select: { isCorrect: true, createdAt: true }
    })

    const fields = records.length > 0
      ? replayPracticeHistory(records)
      : initializeFromAggregates(stat.practiceCount, stat.correctCount)

    await prisma.vocabularyStat.update({
      where: { id: stat.id },
      data: {
        mastery: fields.mastery,
        due: fields.due,
        stability: fields.stability,
        difficulty: fields.difficulty,
        reps: fields.reps,
        lapses: fields.lapses,
        fsrsState: fields.fsrsState,
        lastReview: fields.lastReview,
        retrievability: fields.retrievability,
        recentLapse: fields.recentLapse
      }
    })

    migrated++
    if (migrated % 100 === 0) {
      console.log(`Migrated ${migrated}/${stats.length} stats...`)
    }
  }

  console.log(`FSRS migration complete. Updated ${migrated} vocabulary stats.`)
  const sample = stats[0]
  if (sample) {
    const updated = await prisma.vocabularyStat.findUnique({ where: { id: sample.id } })
    if (updated) {
      console.log('Sample:', buildFsrsFieldsFromStat(updated))
    }
  }
}

main()
  .catch(error => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
