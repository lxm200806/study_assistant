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
  setRoleHandler,
  logoutHandler,
  logoutAllHandler,
  sessionsHandler,
  exportAccountHandler,
  deleteAccountHandler,
  twoFactorStatusHandler,
  twoFactorSetupHandler,
  twoFactorEnableHandler,
  twoFactorDisableHandler,
  changePasswordHandler
} from '../controllers/auth.controller'
import { authMiddleware } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { validateBody, validateParams } from '../validation/validate'
import {
  changePasswordBodySchema,
  credentialsBodySchema,
  deleteAccountBodySchema,
  disableTwoFactorBodySchema,
  idParamsSchema,
  onboardBodySchema,
  refreshBodySchema,
  registerBodySchema,
  roleBodySchema,
  setActiveStudentBodySchema,
  studentNameBodySchema,
  subjectBodySchema,
  twoFactorCodeBodySchema
} from '../validation/schemas'
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
const passwordLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: 'auth-password' })

router.post('/register', registerLimit, validateBody(registerBodySchema), registerHandler)
router.post('/login', loginLimit, validateBody(credentialsBodySchema), loginHandler)
router.post('/refresh', refreshLimit, validateBody(refreshBodySchema), refreshHandler)
router.get('/profile', authMiddleware, profileHandler)
router.post('/logout', authMiddleware, logoutHandler)
router.post('/logout-all', authMiddleware, logoutAllHandler)
router.post('/password', authMiddleware, passwordLimit, validateBody(changePasswordBodySchema), changePasswordHandler)
router.get('/sessions', authMiddleware, sessionsHandler)
router.get('/2fa/status', authMiddleware, twoFactorStatusHandler)
router.post('/2fa/setup', authMiddleware, twoFactorSetupHandler)
router.post('/2fa/enable', authMiddleware, validateBody(twoFactorCodeBodySchema), twoFactorEnableHandler)
router.post('/2fa/disable', authMiddleware, validateBody(disableTwoFactorBodySchema), twoFactorDisableHandler)
router.get('/account/export', authMiddleware, exportAccountHandler)
router.post('/account/delete', authMiddleware, validateBody(deleteAccountBodySchema), deleteAccountHandler)
router.post('/onboard', authMiddleware, validateBody(onboardBodySchema), onboardHandler)
router.put('/subject', authMiddleware, validateBody(subjectBodySchema), setSubjectHandler)
router.get('/students', authMiddleware, listStudentsHandler)
router.post('/students', authMiddleware, validateBody(studentNameBodySchema), createStudentHandler)
router.put('/role', authMiddleware, validateBody(roleBodySchema), setRoleHandler)
router.put('/students/active', authMiddleware, validateBody(setActiveStudentBodySchema), setActiveStudentHandler)
router.put('/students/:id', authMiddleware, validateParams(idParamsSchema), validateBody(studentNameBodySchema), renameStudentHandler)
router.delete('/students/:id', authMiddleware, validateParams(idParamsSchema), archiveStudentHandler)
if (!isProduction() && process.env.WECHAT_LOGIN_STUB === 'true') {
  router.post(
    '/wechat',
    rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: 'auth-wechat' }),
    wechatLoginHandler
  )
}

export default router
