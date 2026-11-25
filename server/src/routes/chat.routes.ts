import { Router } from 'express'
import { sendMessageHandler, getHistoryHandler, getChatQuotaHandler, streamMessageHandler } from '../controllers/chat.controller'
import { authMiddleware } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { validateBody, validateQuery } from '../validation/validate'
import { chatHistoryQuerySchema, chatSendBodySchema } from '../validation/schemas'

const router = Router()

const chatLimit = rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: 'chat' })

router.post('/send', authMiddleware, chatLimit, validateBody(chatSendBodySchema), sendMessageHandler)
router.post('/stream', authMiddleware, chatLimit, validateBody(chatSendBodySchema), streamMessageHandler)
router.get('/history', authMiddleware, validateQuery(chatHistoryQuerySchema), getHistoryHandler)
router.get('/quota', authMiddleware, getChatQuotaHandler)

export default router
