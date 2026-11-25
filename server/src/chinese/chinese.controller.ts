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
  syncCourse,
  todayQueue
} from './course.service'
import { reviewPoint } from './review.service'
import {
  importDrafts,
  listDrafts,
  patchDraft,
  publishDraft,
  publishDraftsBatch
} from './drafts'
import { HttpError } from './http'
import { getResource, seedChineseIfEmpty, summarizeSync, syncAllOfficial, syncResourceById } from './materials'
import { validatedQuery } from '../validation/validate'
import type {
  ChineseDraftListQuery,
  ChineseLibraryQuery,
  ChineseTodayQuery
} from '../validation/schemas'
import { auditAdminAction } from '../services/audit.service'

async function audit(
  req: Request,
  action: string,
  target: string,
  detail?: Record<string, unknown>
) {
  await auditAdminAction({
    actorId: req.userId,
    action,
    target,
    detail,
    ip: req.ip
  })
}

async function withUser(req: Request) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, username: true, isAdmin: true }
  })
  if (!user) throw new HttpError(401, 'Unauthorized')
  return { ...user, learnerId: req.learnerId }
}

function studyId(user: { id: string; learnerId?: string }) {
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

export const libraryHandler = wrap(async (req, res) => {
  const user = await withUser(req)
  const query = validatedQuery<ChineseLibraryQuery>(res)
  return listLibrary(query as Record<string, unknown>, user.isAdmin)
})

export const patchLibraryHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  const result = await patchPublished(req.params.pointId, req.body || {})
  await audit(req, 'chinese.library.patch', req.params.pointId, {
    fields: Object.keys(req.body || {})
  })
  return result
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

export const todayHandler = wrap(async (req, res) => {
  const user = await withUser(req)
  const query = validatedQuery<ChineseTodayQuery>(res)
  return todayQueue(
    req.params.courseId,
    studyId(user),
    query.mode || '',
    query.extraMinutes,
    query.reciteOffset
  )
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
  const result = summarizeSync(await syncAllOfficial(false), 'incremental')
  await audit(req, 'chinese.resources.sync-incremental', 'official')
  return result
})

export const syncAllHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  const result = summarizeSync(await syncAllOfficial(true), 'all')
  await audit(req, 'chinese.resources.sync-all', 'official')
  return result
})

export const seedHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  const result = await seedChineseIfEmpty()
  await audit(req, 'chinese.resources.seed', 'official')
  return result
})

export const getResourceHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  return getResource(req.params.resourceId)
})

export const syncResourceHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  const result = await syncResourceById(req.params.resourceId, true)
  await audit(req, 'chinese.resources.sync', req.params.resourceId)
  return result
})

export const importDraftsHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  const body = req.body || {}
  const result = await importDrafts(
    user.id,
    String(body.text || ''),
    body.resourceId ? String(body.resourceId) : undefined
  )
  await audit(req, 'chinese.drafts.import', String(body.resourceId || ''), {
    imported: Array.isArray((result as { items?: unknown[] }).items)
      ? (result as { items: unknown[] }).items.length
      : undefined
  })
  return result
})

export const listDraftsHandler = wrap(async (req, res) => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  const { status, limit, offset } = validatedQuery<ChineseDraftListQuery>(res)
  return listDrafts(status || 'draft', limit, offset)
})

export const patchDraftHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  const result = await patchDraft(req.params.draftId, req.body || {})
  await audit(req, 'chinese.drafts.patch', req.params.draftId, {
    fields: Object.keys(req.body || {})
  })
  return result
})

export const publishDraftHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  const result = await publishDraft(req.params.draftId)
  await audit(req, 'chinese.drafts.publish', req.params.draftId)
  return result
})

export const publishDraftsBatchHandler = wrap(async req => {
  const user = await withUser(req)
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required')
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
  const result = await publishDraftsBatch(ids)
  await audit(req, 'chinese.drafts.publish-batch', '', { count: ids.length })
  return result
})
