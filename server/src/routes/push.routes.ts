import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { validateBody } from '../validation/validate'
import { registerPushTokenBodySchema } from '../validation/schemas'
import { registerTokenHandler, removeTokenHandler } from '../controllers/push.controller'

const router = Router()
router.use(authMiddleware)
router.post('/register', validateBody(registerPushTokenBodySchema), registerTokenHandler)
router.delete('/register', validateBody(registerPushTokenBodySchema), removeTokenHandler)

export default router
