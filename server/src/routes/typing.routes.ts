import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
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

router.get('/summary', authMiddleware, validateQuery(typingSummaryQuerySchema), typingSummaryHandler)
router.get('/queue', authMiddleware, validateQuery(typingQueueQuerySchema), typingQueueHandler)
router.post('/answer', authMiddleware, validateBody(typingAnswerBodySchema), typingAnswerHandler)
router.put('/marks', authMiddleware, validateBody(typingMarkBodySchema), typingMarkHandler)
router.post('/activity', authMiddleware, validateBody(typingActivityBodySchema), typingActivityHandler)
router.get('/history', authMiddleware, validateQuery(typingHistoryQuerySchema), typingHistoryHandler)
router.post('/sessions', authMiddleware, validateBody(typingSessionBodySchema), typingSessionHandler)

router.get('/lists', authMiddleware, typingListsHandler)
router.post('/lists', authMiddleware, validateBody(typingListBodySchema), typingCreateListHandler)
router.delete('/lists/:id', authMiddleware, validateParams(idParamsSchema), typingDeleteListHandler)

router.get('/articles', authMiddleware, typingArticlesHandler)
router.post('/articles', authMiddleware, validateBody(typingArticleCreateBodySchema), typingCreateArticleHandler)
router.get('/articles/due', authMiddleware, validateQuery(typingDueQuerySchema), typingDueArticlesHandler)
router.post('/articles/answer', authMiddleware, validateBody(typingArticleAnswerBodySchema), typingArticleAnswerHandler)
router.post('/articles/:id/preview', authMiddleware, validateParams(idParamsSchema), validateBody(typingArticleUpdateBodySchema), typingPreviewArticleHandler)
router.put('/articles/:id', authMiddleware, validateParams(idParamsSchema), validateBody(typingArticleUpdateBodySchema), typingUpdateArticleHandler)
router.get('/articles/:id', authMiddleware, validateParams(idParamsSchema), typingArticleHandler)
router.delete('/articles/:id', authMiddleware, validateParams(idParamsSchema), typingDeleteArticleHandler)

export default router
