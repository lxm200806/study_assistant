import { Request, Response } from 'express'
import { getBookMap, getGlobalMap, getBookWordStats } from '../services/graph.service'

export async function getBookMapHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { code } = req.params
    const trainingType = req.query.type as string | undefined

    const data = trainingType
      ? await getBookWordStats(userId, code, trainingType)
      : await getBookMap(userId, code)

    res.status(200).json({ success: true, data })
  } catch (error) {
    const message = (error as Error).message
    res.status(message === 'Book not found' ? 404 : 500).json({ success: false, error: message })
  }
}

export async function getGlobalMapHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const data = await getGlobalMap(userId)
    res.status(200).json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}
