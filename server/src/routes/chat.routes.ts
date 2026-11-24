import { Router } from 'express'
import { sendMessageHandler, getHistoryHandler, getChatQuotaHandler, streamMessageHandler } from '../controllers/chat.controller'
import { authMiddleware } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'

const router = Router()

const chatLimit = rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: 'chat' })

router.post('/send', authMiddleware, chatLimit, sendMessageHandler)
router.post('/stream', authMiddleware, chatLimit, streamMessageHandler)
router.get('/history', authMiddleware, getHistoryHandler)
router.get('/quota', authMiddleware, getChatQuotaHandler)

export default router
