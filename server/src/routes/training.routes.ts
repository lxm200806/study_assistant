import { Router } from 'express'
import { practiceHandler, getReviewHandler, getHistoryHandler, completeSessionHandler } from '../controllers/training.controller'
import { getQuizWordsHandler, submitQuizHandler } from '../controllers/quiz.controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/practice', authMiddleware, practiceHandler)
router.post('/session/complete', authMiddleware, completeSessionHandler)
router.get('/review', authMiddleware, getReviewHandler)
router.get('/history', authMiddleware, getHistoryHandler)
router.get('/quiz/words', authMiddleware, getQuizWordsHandler)
router.post('/quiz/submit', authMiddleware, submitQuizHandler)

export default router