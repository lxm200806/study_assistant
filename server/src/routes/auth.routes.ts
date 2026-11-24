import { Router } from 'express'
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  profileHandler,
  onboardHandler,
  wechatLoginHandler,
  setSubjectHandler,
  listStudentsHandler,
  createStudentHandler,
  renameStudentHandler,
  archiveStudentHandler,
  setActiveStudentHandler,
  setRoleHandler
} from '../controllers/auth.controller'
import { authMiddleware } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { isProduction } from '../config/env'

const router = Router()

const registerLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: 'auth-register' })
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'auth-login',
  key: req => `${req.ip || 'unknown'}:${String(req.body?.username || '').toLowerCase()}`
})
const refreshLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, keyPrefix: 'auth-refresh' })

router.post('/register', registerLimit, registerHandler)
router.post('/login', loginLimit, loginHandler)
router.post('/refresh', refreshLimit, refreshHandler)
router.get('/profile', authMiddleware, profileHandler)
router.post('/onboard', authMiddleware, onboardHandler)
router.put('/subject', authMiddleware, setSubjectHandler)
router.get('/students', authMiddleware, listStudentsHandler)
router.post('/students', authMiddleware, createStudentHandler)
router.put('/role', authMiddleware, setRoleHandler)
router.put('/students/active', authMiddleware, setActiveStudentHandler)
router.put('/students/:id', authMiddleware, renameStudentHandler)
router.delete('/students/:id', authMiddleware, archiveStudentHandler)
if (!isProduction()) {
  router.post(
    '/wechat',
    rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: 'auth-wechat' }),
    wechatLoginHandler
  )
}

export default router
