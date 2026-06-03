import { Router } from 'express'
import { practiceHandler, getReviewHandler, getHistoryHandler, completeSessionHandler } from '../controllers/training.controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/practice', authMiddleware, practiceHandler)
router.post('/session/complete', authMiddleware, completeSessionHandler)
router.get('/review', authMiddleware, getReviewHandler)
router.get('/history', authMiddleware, getHistoryHandler)

export default router