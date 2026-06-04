import { Request, Response } from 'express'
import { sendChatMessage, getChatHistory } from '../services/chat.service'

export async function sendMessageHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { content, bookCode } = req.body

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' })
    }

    const result = await sendChatMessage(userId, content, bookCode)
    res.status(200).json(result)
  } catch (error) {
    const msg = (error as Error).message
    res.status(msg === 'CHAT_LIMIT' ? 429 : 500).json({ error: msg === 'CHAT_LIMIT' ? '今日免费对话次数已用完' : msg })
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
