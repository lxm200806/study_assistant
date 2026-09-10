import express from 'express'
import { getDailyStatsHandler, getWeeklyReportHandler } from '../controllers/daily.controller'
import { getBookMapHandler, getGlobalMapHandler } from '../controllers/stats.controller'
import { authMiddleware } from '../middleware/auth'

const router = express.Router()

router.get('/daily', authMiddleware, getDailyStatsHandler)
router.get('/weekly-report', authMiddleware, getWeeklyReportHandler)
router.get('/book/:code/map', authMiddleware, getBookMapHandler)
router.get('/global/map', authMiddleware, getGlobalMapHandler)

export default router
