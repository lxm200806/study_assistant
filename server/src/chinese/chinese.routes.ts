import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
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
router.get('/library', authMiddleware, libraryHandler)
router.patch('/library/:pointId', authMiddleware, patchLibraryHandler)
router.put('/library/:pointId', authMiddleware, patchLibraryHandler)
router.get('/library/coverage', authMiddleware, coverageHandler)
router.post('/courses', authMiddleware, createCourseHandler)
router.get('/courses', authMiddleware, listCoursesHandler)
router.post('/courses/preview', authMiddleware, previewCourseHandler)
router.patch('/courses/:courseId', authMiddleware, patchCourseHandler)
router.put('/courses/:courseId', authMiddleware, patchCourseHandler)
router.delete('/courses/:courseId', authMiddleware, deleteCourseHandler)
router.post('/courses/:courseId/sync', authMiddleware, syncCourseHandler)
router.get('/courses/:courseId/today', authMiddleware, todayHandler)
router.get('/courses/:courseId/plan', authMiddleware, planHandler)
router.post('/courses/:courseId/review', authMiddleware, reviewHandler)
router.get('/courses/:courseId/stats', authMiddleware, statsHandler)
router.get('/resources', authMiddleware, resourcesHandler)
router.post('/resources/sync-incremental', authMiddleware, syncIncrementalHandler)
router.post('/resources/sync-all', authMiddleware, syncAllHandler)
router.post('/resources/seed', authMiddleware, seedHandler)
router.get('/resources/:resourceId', authMiddleware, getResourceHandler)
router.post('/resources/:resourceId/sync', authMiddleware, syncResourceHandler)
router.post('/drafts/import', authMiddleware, importDraftsHandler)
router.get('/drafts', authMiddleware, listDraftsHandler)
router.post('/drafts/publish-batch', authMiddleware, publishDraftsBatchHandler)
router.patch('/drafts/:draftId', authMiddleware, patchDraftHandler)
router.put('/drafts/:draftId', authMiddleware, patchDraftHandler)
router.post('/drafts/:draftId/publish', authMiddleware, publishDraftHandler)

export default router
