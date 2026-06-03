import { Request, Response } from 'express'
import { sendMessage, getChatHistory } from '../services/chat.service'

export async function sendMessageHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { content } = req.body
    
    if (!content) {
      return res.status(400).json({ error: 'Message content is required' })
    }
    
    const result = await sendMessage(userId, content)
    res.status(200).json(result)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}

export async function getHistoryHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    
    const history = await getChatHistory(userId, page, limit)
    res.status(200).json(history)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}