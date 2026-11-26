import express from 'express'
import { getDailyStatsHandler, getWeeklyReportHandler } from '../controllers/daily.controller'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/entitlement'
import { PERMISSIONS } from '../entitlements/permissions'

const router = express.Router()

router.get('/daily', authMiddleware, getDailyStatsHandler)
router.get(
  '/weekly-report',
  authMiddleware,
  requirePermission(PERMISSIONS.STATS_WEEKLY),
  getWeeklyReportHandler
)

export default router
