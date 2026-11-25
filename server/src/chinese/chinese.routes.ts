import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { validateBody, validateParams, validateQuery } from '../validation/validate'
import {
  chineseAdminPatchBodySchema,
  chineseCourseBodySchema,
  chineseCoursePatchBodySchema,
  chineseCoursePreviewBodySchema,
  chineseDraftImportBodySchema,
  chineseDraftListQuerySchema,
  chineseDraftPatchBodySchema,
  chineseLibraryQuerySchema,
  chinesePublishBatchBodySchema,
  chineseReviewBodySchema,
  chineseTodayQuerySchema,
  courseIdParamsSchema,
  draftIdParamsSchema,
  pointIdParamsSchema,
  resourceIdParamsSchema
} from '../validation/schemas'
import {
  coverageHandler,
  createCourseHandler,
  deleteCourseHandler,
  getResourceHandler,
  importDraftsHandler,
  libraryHandler,
  listCoursesHandler,
  listDraftsHandler,
  metaHandler,
  patchCourseHandler,
  patchDraftHandler,
  patchLibraryHandler,
  planHandler,
  previewCourseHandler,
  publishDraftHandler,
  publishDraftsBatchHandler,
  resourcesHandler,
  reviewHandler,
  seedHandler,
  statsHandler,
  syncAllHandler,
  syncCourseHandler,
  syncIncrementalHandler,
  syncResourceHandler,
  todayHandler
} from './chinese.controller'

const router = Router()

router.get('/meta', metaHandler)
router.get('/library', authMiddleware, validateQuery(chineseLibraryQuerySchema), libraryHandler)
router.patch('/library/:pointId', authMiddleware, validateParams(pointIdParamsSchema), validateBody(chineseAdminPatchBodySchema), patchLibraryHandler)
router.put('/library/:pointId', authMiddleware, validateParams(pointIdParamsSchema), validateBody(chineseAdminPatchBodySchema), patchLibraryHandler)
router.get('/library/coverage', authMiddleware, coverageHandler)
router.post('/courses', authMiddleware, validateBody(chineseCourseBodySchema), createCourseHandler)
router.get('/courses', authMiddleware, listCoursesHandler)
router.post('/courses/preview', authMiddleware, validateBody(chineseCoursePreviewBodySchema), previewCourseHandler)
router.patch('/courses/:courseId', authMiddleware, validateParams(courseIdParamsSchema), validateBody(chineseCoursePatchBodySchema), patchCourseHandler)
router.put('/courses/:courseId', authMiddleware, validateParams(courseIdParamsSchema), validateBody(chineseCoursePatchBodySchema), patchCourseHandler)
router.delete('/courses/:courseId', authMiddleware, validateParams(courseIdParamsSchema), deleteCourseHandler)
router.post('/courses/:courseId/sync', authMiddleware, validateParams(courseIdParamsSchema), syncCourseHandler)
router.get('/courses/:courseId/today', authMiddleware, validateParams(courseIdParamsSchema), validateQuery(chineseTodayQuerySchema), todayHandler)
router.get('/courses/:courseId/plan', authMiddleware, validateParams(courseIdParamsSchema), planHandler)
router.post('/courses/:courseId/review', authMiddleware, validateParams(courseIdParamsSchema), validateBody(chineseReviewBodySchema), reviewHandler)
router.get('/courses/:courseId/stats', authMiddleware, validateParams(courseIdParamsSchema), statsHandler)
router.get('/resources', authMiddleware, resourcesHandler)
router.post('/resources/sync-incremental', authMiddleware, syncIncrementalHandler)
router.post('/resources/sync-all', authMiddleware, syncAllHandler)
router.post('/resources/seed', authMiddleware, seedHandler)
router.get('/resources/:resourceId', authMiddleware, validateParams(resourceIdParamsSchema), getResourceHandler)
router.post('/resources/:resourceId/sync', authMiddleware, validateParams(resourceIdParamsSchema), syncResourceHandler)
router.post('/drafts/import', authMiddleware, validateBody(chineseDraftImportBodySchema), importDraftsHandler)
router.get('/drafts', authMiddleware, validateQuery(chineseDraftListQuerySchema), listDraftsHandler)
router.post('/drafts/publish-batch', authMiddleware, validateBody(chinesePublishBatchBodySchema), publishDraftsBatchHandler)
router.patch('/drafts/:draftId', authMiddleware, validateParams(draftIdParamsSchema), validateBody(chineseDraftPatchBodySchema), patchDraftHandler)
router.put('/drafts/:draftId', authMiddleware, validateParams(draftIdParamsSchema), validateBody(chineseDraftPatchBodySchema), patchDraftHandler)
router.post('/drafts/:draftId/publish', authMiddleware, validateParams(draftIdParamsSchema), publishDraftHandler)

export default router
