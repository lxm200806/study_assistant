import { Router } from 'express'
import { sendMessageHandler, getHistoryHandler, getChatQuotaHandler, streamMessageHandler } from '../controllers/chat.controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/send', authMiddleware, sendMessageHandler)
router.post('/stream', authMiddleware, streamMessageHandler)
router.get('/history', authMiddleware, getHistoryHandler)
router.get('/quota', authMiddleware, getChatQuotaHandler)

export default router
