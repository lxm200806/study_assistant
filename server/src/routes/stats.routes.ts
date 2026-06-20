import express from 'express'
import { getDailyStatsHandler, getWeeklyReportHandler } from '../controllers/daily.controller'
import { authMiddleware } from '../middleware/auth'

const router = express.Router()

router.get('/daily', authMiddleware, getDailyStatsHandler)
router.get('/weekly-report', authMiddleware, getWeeklyReportHandler)

export default router
