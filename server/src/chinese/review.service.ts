import prisma from '../prisma/client'
import { Prisma } from '@prisma/client'
import { runSerializable } from '../prisma/tx'
import { HttpError } from './http'
import { answerLines, normalizeMode, reviewOutcome } from './study-modes'
import { gradeCard } from './grade'
import * as sm2 from './sm2'
import { kidFeedback } from './progress'
import { ownCourse, toPointLike } from './course.service'

async function markEntryKnown(
  db: Prisma.TransactionClient,
  courseId: string,
  userId: string,
  entryKey: string,
  today: string,
  exceptPointId = ''
) {
  if (!entryKey) return
  const siblings = await db.chineseCourseItem.findMany({
    where: { courseId, point: { entryKey } },
    select: { pointId: true }
  })
  const due = sm2.parseDay(sm2.addDays(today, 21))
  const last = sm2.parseDay(today)
  for (const row of siblings) {
    if (row.pointId === exceptPointId) continue
    await db.chineseReviewState.upsert({
      where: { learnerId_courseId_pointId: { learnerId: userId, courseId, pointId: row.pointId } },
      create: {
        learnerId: userId,
        courseId,
        pointId: row.pointId,
        n: 4,
        ef: 2.5,
        interval: 21,
        due: due || undefined,
        lapses: 0,
        last: last || undefined
      },
      update: {
        n: 4,
        interval: 21,
        due: due || undefined,
        last: last || undefined
      }
    })
  }
}

export async function reviewPoint(courseId: string, userId: string, body: { pointId?: string; answer?: string; reveal?: boolean; mode?: string; selfRating?: string }) {
  const today = sm2.todayText()
  const mode = normalizeMode(body.mode)
  await ownCourse(courseId, userId)
  const item = await prisma.chineseCourseItem.findUnique({
    where: { courseId_pointId: { courseId, pointId: String(body.pointId || '') } },
    include: { point: true }
  })
  if (!item) throw new HttpError(404, '该课程没有这个知识点')
  return runSerializable(async tx => {
    const state = await tx.chineseReviewState.findUnique({
      where: { learnerId_courseId_pointId: { learnerId: userId, courseId, pointId: item.pointId } }
    })
    const point = toPointLike({ ...item.point, ...state })
    const isNew = !point.last
    const prevState = { n: Number(point.n || 0), ef: Number(point.ef || 2.5), interval: Number(point.interval || 0), lapses: Number(point.lapses || 0) }
    const selfRating = String(body.selfRating || '')
    if (selfRating && String(point.question_type) !== 'recite') throw new HttpError(400, '只有背诵卡可以自评')
    const submittedAnswer = selfRating === 'known' ? point.answer : selfRating === 'again' ? '' : body.answer
    const result = body.reveal ? gradeCard(point, '', true) : gradeCard(point, submittedAnswer, false)
    const outcome = reviewOutcome(mode, result, Boolean(body.reveal))
    if (!outcome.ok) throw new HttpError(400, outcome.error || '不能提交')
    result.quality = Number(outcome.quality || 1)
    result.correct = Boolean(outcome.correct)
    let nextState: sm2.Sm2State = { ...prevState, due: '', last: '' }
    if (outcome.update_sm2) {
      nextState = sm2.schedule(prevState, result.quality, today)
      await tx.chineseReviewState.upsert({
        where: { learnerId_courseId_pointId: { learnerId: userId, courseId, pointId: item.pointId } },
        create: {
          learnerId: userId,
          courseId,
          pointId: item.pointId,
          n: nextState.n,
          ef: nextState.ef,
          interval: nextState.interval,
          due: sm2.parseDay(nextState.due) || undefined,
          lapses: nextState.lapses,
          last: sm2.parseDay(nextState.last) || undefined
        },
        update: {
          n: nextState.n,
          ef: nextState.ef,
          interval: nextState.interval,
          due: sm2.parseDay(nextState.due) || undefined,
          lapses: nextState.lapses,
          last: sm2.parseDay(nextState.last) || undefined
        }
      })
      await tx.chineseReviewLog.create({
        data: {
          learnerId: userId,
          courseId,
          pointId: item.pointId,
          quality: result.quality,
          isNew,
          correct: result.correct
        }
      })
      if (mode === 'filter' && result.correct) {
        await markEntryKnown(tx, courseId, userId, String(point.entry_key || ''), today, item.pointId)
      }
    }
    return {
      ...result,
      answer: point.answer,
      lines: answerLines(point.answer),
      state: nextState,
      isNew,
      mode,
      updateSm2: outcome.update_sm2,
      revealed: Boolean(body.reveal),
      feedback: kidFeedback(mode, result, Boolean(body.reveal), outcome.update_sm2)
    }
  })
}
