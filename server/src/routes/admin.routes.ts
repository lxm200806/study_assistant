import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { adminMiddleware } from '../middleware/admin'
import { getAuditHandler, getMissingSummaryHandler, getMissingWordsHandler } from '../controllers/admin.controller'
import { validateQuery } from '../validation/validate'
import { adminAuditQuerySchema, adminMissingWordsQuerySchema } from '../validation/schemas'

const router = Router()

router.use(authMiddleware, adminMiddleware)

router.get('/vocabulary/missing/summary', getMissingSummaryHandler)
router.get('/vocabulary/missing', validateQuery(adminMissingWordsQuerySchema), getMissingWordsHandler)
router.get('/audit', validateQuery(adminAuditQuerySchema), getAuditHandler)

export default router
