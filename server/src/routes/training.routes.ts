import { Router } from 'express'
import {
  practiceHandler,
  getReviewHandler,
  getHistoryHandler,
  completeSessionHandler,
  recheckHandler
} from '../controllers/training.controller'
import { getQuizWordsHandler, submitQuizHandler } from '../controllers/quiz.controller'
import { authMiddleware } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { validateBody, validateQuery } from '../validation/validate'
import {
  completeSessionBodySchema,
  historyQuerySchema,
  practiceBodySchema,
  quizSubmitBodySchema,
  quizWordsQuerySchema,
  reviewQuerySchema
} from '../validation/schemas'

const router = Router()

router.post('/practice', authMiddleware, validateBody(practiceBodySchema), idempotency(), practiceHandler)
router.post('/recheck', authMiddleware, recheckHandler)
router.post('/session/complete', authMiddleware, validateBody(completeSessionBodySchema), idempotency(), completeSessionHandler)
router.get('/review', authMiddleware, validateQuery(reviewQuerySchema), getReviewHandler)
router.get('/history', authMiddleware, validateQuery(historyQuerySchema), getHistoryHandler)
router.get('/quiz/words', authMiddleware, validateQuery(quizWordsQuerySchema), getQuizWordsHandler)
router.post('/quiz/submit', authMiddleware, validateBody(quizSubmitBodySchema), submitQuizHandler)

export default router
