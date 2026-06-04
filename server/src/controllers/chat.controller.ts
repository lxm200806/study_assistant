import { Request, Response } from 'express'
import { sendChatMessage, getChatHistory, getChatRemaining, type ChatMode } from '../services/chat.service'
import { streamChatMessage } from '../services/chat-stream.service'

export async function streamMessageHandler(req: Request, res: Response) {
  const userId = req.userId!
  const { content, bookCode, mode, scenario } = req.body as {
    content?: string
    bookCode?: string
    mode?: ChatMode
    scenario?: string
  }

  if (!content) {
    return res.status(400).json({ success: false, error: 'Message content is required' })
  }

  await streamChatMessage(res, userId, content, bookCode, mode || 'free', scenario)
}

export async function sendMessageHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { content, bookCode, mode, scenario } = req.body as {
      content?: string
      bookCode?: string
      mode?: ChatMode
      scenario?: string
    }

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' })
    }

    const result = await sendChatMessage(
      userId,
      content,
      bookCode,
      mode || 'free',
      scenario
    )
    res.status(200).json({ success: true, data: result })
  } catch (error) {
    const msg = (error as Error).message
    res.status(msg === 'CHAT_LIMIT' ? 429 : 500).json({
      success: false,
      error: msg === 'CHAT_LIMIT' ? '今日免费对话次数已用完' : msg
    })
  }
}

export async function getHistoryHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const history = await getChatHistory(userId, page, limit)
    res.status(200).json({ success: true, data: history })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getChatQuotaHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const quota = await getChatRemaining(userId)
    res.status(200).json({ success: true, data: quota })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}
