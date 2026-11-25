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
import { validateBody } from '../validation/validate'
import { completeSessionBodySchema, practiceBodySchema } from '../validation/schemas'

const router = Router()

router.post('/practice', authMiddleware, validateBody(practiceBodySchema), practiceHandler)
router.post('/recheck', authMiddleware, recheckHandler)
router.post('/session/complete', authMiddleware, validateBody(completeSessionBodySchema), completeSessionHandler)
router.get('/review', authMiddleware, getReviewHandler)
router.get('/history', authMiddleware, getHistoryHandler)
router.get('/quiz/words', authMiddleware, getQuizWordsHandler)
router.post('/quiz/submit', authMiddleware, submitQuizHandler)

export default router
