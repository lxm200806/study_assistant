import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
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

router.get('/summary', authMiddleware, typingSummaryHandler)
router.get('/queue', authMiddleware, typingQueueHandler)
router.post('/answer', authMiddleware, typingAnswerHandler)
router.put('/marks', authMiddleware, typingMarkHandler)
router.post('/activity', authMiddleware, typingActivityHandler)
router.get('/history', authMiddleware, typingHistoryHandler)
router.post('/sessions', authMiddleware, typingSessionHandler)

router.get('/lists', authMiddleware, typingListsHandler)
router.post('/lists', authMiddleware, typingCreateListHandler)
router.delete('/lists/:id', authMiddleware, typingDeleteListHandler)

router.get('/articles', authMiddleware, typingArticlesHandler)
router.post('/articles', authMiddleware, typingCreateArticleHandler)
router.get('/articles/due', authMiddleware, typingDueArticlesHandler)
router.post('/articles/answer', authMiddleware, typingArticleAnswerHandler)
router.post('/articles/:id/preview', authMiddleware, typingPreviewArticleHandler)
router.put('/articles/:id', authMiddleware, typingUpdateArticleHandler)
router.get('/articles/:id', authMiddleware, typingArticleHandler)
router.delete('/articles/:id', authMiddleware, typingDeleteArticleHandler)

export default router
