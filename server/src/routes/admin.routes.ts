import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { adminMiddleware } from '../middleware/admin'
import { getMissingSummaryHandler, getMissingWordsHandler } from '../controllers/admin.controller'

const router = Router()

router.use(authMiddleware, adminMiddleware)

router.get('/vocabulary/missing/summary', getMissingSummaryHandler)
router.get('/vocabulary/missing', getMissingWordsHandler)

export default router
