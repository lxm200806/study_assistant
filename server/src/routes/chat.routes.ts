import { Router } from 'express'
import { sendMessageHandler, getHistoryHandler } from '../controllers/chat.controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/send', authMiddleware, sendMessageHandler)
router.get('/history', authMiddleware, getHistoryHandler)

export default router