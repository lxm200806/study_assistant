import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { asyncHandler } from '../utils/async-handler'
import { getEntitlementsHandler } from '../controllers/entitlement.controller'

const router = Router()

router.get('/', authMiddleware, asyncHandler(getEntitlementsHandler))

export default router
