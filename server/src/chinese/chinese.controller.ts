import { Request, Response, NextFunction } from 'express'
import prisma from '../prisma/client'
import {
  createCourse,
  coursePlan,
  courseStats,
  deleteCourse,
  libraryCoverage,
  listCourses,
  listLibrary,
  listResources,
  metaPayload,
  patchCourse,
  patchPublished,
  previewCourse,
  reviewPoint,
  syncCourse,
  todayQueue
} from './course.service'
import {
  importDrafts,
  listDrafts,
  patchDraft,
  publishDraft,
  publishDraftsBatch
} from './drafts'
import { HttpError } from './http'
import { getResource, seedChineseIfEmpty, summarizeSync, syncAllOfficial, syncResourceById } from './materials'

async function withUser(req: Request) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, username: true, isAdmin: true, accountType: true }
  })
  if (!user) throw new HttpError(401, 'Unauthorized')
  return { ...user, learnerId: req.learnerId }
}

function studyId(user: { id: string; accountType?: string | null; learnerId?: string }) {
  if (!user.learnerId) throw new HttpError(409, '请先添加学生')
  return user.learnerId
}

function wrap(handler: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await handler(req, res)
      if (result !== undefined) res.json(result)
    } catch (error) {
      next(error)
    }
  }
}

export const metaHandler = wrap(async () => metaPayload())

export const libraryHandler = wrap(async req => {
  const user = await withUser(req)
  return listLibrary(req.query as Record<string, unknown>, user.isAdmin)
})

export const patchLibraryHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  return patchPublished(req.params.pointId, req.body || {})
})

export const createCourseHandler = wrap(async req => {
  const user = await withUser(req)
  return createCourse(studyId(user), req.body || {})
})

export const listCoursesHandler = wrap(async req => {
  const user = await withUser(req)
  return listCourses(studyId(user))
})

export const previewCourseHandler = wrap(async req => {
  await withUser(req)
  return previewCourse(req.body || {})
})

export const patchCourseHandler = wrap(async req => {
  const user = await withUser(req)
  return patchCourse(req.params.courseId, studyId(user), req.body || {})
})

export const deleteCourseHandler = wrap(async req => {
  const user = await withUser(req)
  return deleteCourse(req.params.courseId, studyId(user))
})

export const syncCourseHandler = wrap(async req => {
  const user = await withUser(req)
  return syncCourse(req.params.courseId, studyId(user))
})

export const todayHandler = wrap(async req => {
  const user = await withUser(req)
  return todayQueue(req.params.courseId, studyId(user), String(req.query.mode || ''))
})

export const planHandler = wrap(async req => {
  const user = await withUser(req)
  return coursePlan(req.params.courseId, studyId(user))
})

export const reviewHandler = wrap(async req => {
  const user = await withUser(req)
  return reviewPoint(req.params.courseId, studyId(user), req.body || {})
})

export const statsHandler = wrap(async req => {
  const user = await withUser(req)
  return courseStats(req.params.courseId, studyId(user))
})

export const coverageHandler = wrap(async req => {
  const user = await withUser(req)
  return libraryCoverage(studyId(user))
})

export const resourcesHandler = wrap(async req => {
  const user = await withUser(req)
  return listResources(user.isAdmin, user.id)
})

export const syncIncrementalHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  return summarizeSync(await syncAllOfficial(false), 'incremental')
})

export const syncAllHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  return summarizeSync(await syncAllOfficial(true), 'all')
})

export const seedHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  return seedChineseIfEmpty()
})

export const getResourceHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  return getResource(req.params.resourceId)
})

export const syncResourceHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  return syncResourceById(req.params.resourceId, true)
})

export const importDraftsHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  const body = req.body || {}
  return importDrafts(user.id, String(body.text || ''), body.resourceId ? String(body.resourceId) : undefined)
})

export const listDraftsHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  return listDrafts(String(req.query.status || 'draft'), req.query.limit, req.query.offset)
})

export const patchDraftHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  return patchDraft(req.params.draftId, req.body || {})
})

export const publishDraftHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  return publishDraft(req.params.draftId)
})

export const publishDraftsBatchHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  return publishDraftsBatch(Array.isArray(req.body?.ids) ? req.body.ids : [])
})
