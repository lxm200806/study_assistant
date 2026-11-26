import { Router } from 'express'
import { sendMessageHandler, getHistoryHandler, getChatQuotaHandler, streamMessageHandler } from '../controllers/chat.controller'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/entitlement'
import { rateLimit } from '../middleware/rate-limit'
import { PERMISSIONS } from '../entitlements/permissions'
import { validateBody, validateQuery } from '../validation/validate'
import { chatHistoryQuerySchema, chatSendBodySchema } from '../validation/schemas'

const router = Router()

const chatLimit = rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: 'chat' })
const chatGate = [authMiddleware, chatLimit, requirePermission(PERMISSIONS.AI_CHAT_TEXT)]

router.post('/send', ...chatGate, validateBody(chatSendBodySchema), sendMessageHandler)
router.post('/stream', ...chatGate, validateBody(chatSendBodySchema), streamMessageHandler)
router.get('/history', authMiddleware, validateQuery(chatHistoryQuerySchema), getHistoryHandler)
router.get('/quota', authMiddleware, getChatQuotaHandler)

export default router
