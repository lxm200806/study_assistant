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
import { requirePermission, requireTrainingPermission } from '../middleware/entitlement'
import { PERMISSIONS } from '../entitlements/permissions'
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

router.post(
  '/practice',
  authMiddleware,
  validateBody(practiceBodySchema),
  requireTrainingPermission,
  idempotency(),
  practiceHandler
)
router.post('/recheck', authMiddleware, requireTrainingPermission, recheckHandler)
router.post('/session/complete', authMiddleware, validateBody(completeSessionBodySchema), idempotency(), completeSessionHandler)
router.get(
  '/review',
  authMiddleware,
  validateQuery(reviewQuerySchema),
  requireTrainingPermission,
  getReviewHandler
)
router.get('/history', authMiddleware, validateQuery(historyQuerySchema), getHistoryHandler)
router.get(
  '/quiz/words',
  authMiddleware,
  validateQuery(quizWordsQuerySchema),
  requirePermission(PERMISSIONS.ENGLISH_QUIZ),
  getQuizWordsHandler
)
router.post(
  '/quiz/submit',
  authMiddleware,
  validateBody(quizSubmitBodySchema),
  requirePermission(PERMISSIONS.ENGLISH_QUIZ),
  submitQuizHandler
)

export default router
