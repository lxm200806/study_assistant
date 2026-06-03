import { Router } from 'express'
import { registerHandler, loginHandler, refreshHandler, profileHandler } from '../controllers/auth.controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/register', registerHandler)
router.post('/login', loginHandler)
router.post('/refresh', refreshHandler)
router.get('/profile', authMiddleware, profileHandler)

export default router