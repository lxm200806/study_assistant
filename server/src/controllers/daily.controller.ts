import { Request, Response } from 'express'
import { getDailyStats, getWeeklyReport } from '../services/daily-study.service'
import { internalError } from '../utils/http-errors'

export async function getDailyStatsHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    const data = await getDailyStats(userId)
    res.status(200).json({ success: true, data })
  } catch (error) {
    internalError(res, error)
  }
}

export async function getWeeklyReportHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    const data = await getWeeklyReport(userId)
    res.status(200).json({ success: true, data })
  } catch (error) {
    internalError(res, error)
  }
}
