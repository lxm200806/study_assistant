import { Router } from 'express'
import { registerHandler, loginHandler, refreshHandler, profileHandler, onboardHandler, wechatLoginHandler } from '../controllers/auth.controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/register', registerHandler)
router.post('/login', loginHandler)
router.post('/refresh', refreshHandler)
router.get('/profile', authMiddleware, profileHandler)
router.post('/onboard', authMiddleware, onboardHandler)
router.post('/wechat', wechatLoginHandler)

export default router