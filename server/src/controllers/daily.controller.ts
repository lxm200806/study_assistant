import { Request, Response } from 'express'
import { getDailyStats, getWeeklyReport } from '../services/daily-study.service'

export async function getDailyStatsHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const data = await getDailyStats(userId)
    res.status(200).json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getWeeklyReportHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const data = await getWeeklyReport(userId)
    res.status(200).json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}
