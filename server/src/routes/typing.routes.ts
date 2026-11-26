import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/entitlement'
import { PERMISSIONS } from '../entitlements/permissions'
import { validateBody, validateParams, validateQuery } from '../validation/validate'
import {
  idParamsSchema,
  typingActivityBodySchema,
  typingAnswerBodySchema,
  typingArticleAnswerBodySchema,
  typingArticleCreateBodySchema,
  typingArticleUpdateBodySchema,
  typingDueQuerySchema,
  typingHistoryQuerySchema,
  typingListBodySchema,
  typingMarkBodySchema,
  typingQueueQuerySchema,
  typingSessionBodySchema,
  typingSummaryQuerySchema
} from '../validation/schemas'
import {
  typingActivityHandler,
  typingAnswerHandler,
  typingArticleHandler,
  typingArticlesHandler,
  typingCreateArticleHandler,
  typingCreateListHandler,
  typingArticleAnswerHandler,
  typingDeleteArticleHandler,
  typingDeleteListHandler,
  typingDueArticlesHandler,
  typingHistoryHandler,
  typingListsHandler,
  typingMarkHandler,
  typingPreviewArticleHandler,
  typingQueueHandler,
  typingSessionHandler,
  typingSummaryHandler,
  typingUpdateArticleHandler
} from '../controllers/typing.controller'

const router = Router()
const typingGate = [authMiddleware, requirePermission(PERMISSIONS.ENGLISH_TYPING)]
const articleGate = [authMiddleware, requirePermission(PERMISSIONS.ENGLISH_ARTICLE)]

router.get('/summary', ...typingGate, validateQuery(typingSummaryQuerySchema), typingSummaryHandler)
router.get('/queue', ...typingGate, validateQuery(typingQueueQuerySchema), typingQueueHandler)
router.post('/answer', ...typingGate, validateBody(typingAnswerBodySchema), typingAnswerHandler)
router.put('/marks', ...typingGate, validateBody(typingMarkBodySchema), typingMarkHandler)
router.post('/activity', ...typingGate, validateBody(typingActivityBodySchema), typingActivityHandler)
router.get('/history', ...typingGate, validateQuery(typingHistoryQuerySchema), typingHistoryHandler)
router.post('/sessions', ...typingGate, validateBody(typingSessionBodySchema), typingSessionHandler)

router.get('/lists', ...typingGate, typingListsHandler)
router.post('/lists', ...typingGate, validateBody(typingListBodySchema), typingCreateListHandler)
router.delete('/lists/:id', ...typingGate, validateParams(idParamsSchema), typingDeleteListHandler)

router.get('/articles', ...articleGate, typingArticlesHandler)
router.post('/articles', ...articleGate, validateBody(typingArticleCreateBodySchema), typingCreateArticleHandler)
router.get('/articles/due', ...articleGate, validateQuery(typingDueQuerySchema), typingDueArticlesHandler)
router.post('/articles/answer', ...articleGate, validateBody(typingArticleAnswerBodySchema), typingArticleAnswerHandler)
router.post('/articles/:id/preview', ...articleGate, validateParams(idParamsSchema), validateBody(typingArticleUpdateBodySchema), typingPreviewArticleHandler)
router.put('/articles/:id', ...articleGate, validateParams(idParamsSchema), validateBody(typingArticleUpdateBodySchema), typingUpdateArticleHandler)
router.get('/articles/:id', ...articleGate, validateParams(idParamsSchema), typingArticleHandler)
router.delete('/articles/:id', ...articleGate, validateParams(idParamsSchema), typingDeleteArticleHandler)

export default router
