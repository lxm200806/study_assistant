import express from 'express'
import { getBookMapHandler, getGlobalMapHandler } from '../controllers/stats.controller'
import { getDailyStatsHandler, getWeeklyReportHandler } from '../controllers/daily.controller'
import { authMiddleware } from '../middleware/auth'

const router = express.Router()

router.get('/book/:code/map', authMiddleware, getBookMapHandler)
router.get('/global/map', authMiddleware, getGlobalMapHandler)
router.get('/daily', authMiddleware, getDailyStatsHandler)
router.get('/weekly-report', authMiddleware, getWeeklyReportHandler)

export default router
