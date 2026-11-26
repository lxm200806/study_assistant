import { Request, Response } from 'express'
import { sendChatMessage, getChatHistory, getChatRemaining, type ChatMode } from '../services/chat.service'
import { streamChatMessage } from '../services/chat-stream.service'
import { assertBookAccess } from '../services/book-access.service'
import { internalError } from '../utils/http-errors'
import { validatedQuery } from '../validation/validate'
import type { ChatHistoryQuery } from '../validation/schemas'

const MAX_MESSAGE_LENGTH = 2000

function normalizeContent(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const content = raw.trim()
  if (!content || content.length > MAX_MESSAGE_LENGTH) return null
  return content
}

export async function streamMessageHandler(req: Request, res: Response) {
  const userId = req.learnerId
  if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
  const { content, bookCode, mode, scenario } = req.body as {
    content?: string
    bookCode?: string
    mode?: ChatMode
    scenario?: string
  }

  const text = normalizeContent(content)
  if (!text) {
    return res.status(400).json({
      success: false,
      error: `Message content must be 1-${MAX_MESSAGE_LENGTH} characters`
    })
  }

  if (bookCode) {
    try {
      await assertBookAccess(userId, bookCode)
    } catch (error) {
      const message = (error as Error).message
      if (message === 'BOOK_LOCKED') {
        return res.status(403).json({ success: false, error: 'BOOK_LOCKED' })
      }
      return internalError(res, error)
    }
  }

  await streamChatMessage(res, userId, text, bookCode, mode || 'free', scenario)
}

export async function sendMessageHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    const { content, bookCode, mode, scenario } = req.body as {
      content?: string
      bookCode?: string
      mode?: ChatMode
      scenario?: string
    }

    const text = normalizeContent(content)
    if (!text) {
      return res.status(400).json({
        success: false,
        error: `Message content must be 1-${MAX_MESSAGE_LENGTH} characters`
      })
    }

    if (bookCode) {
      await assertBookAccess(userId, bookCode)
    }

    const result = await sendChatMessage(
      userId,
      text,
      bookCode,
      mode || 'free',
      scenario
    )
    res.status(200).json({ success: true, data: result })
  } catch (error) {
    const msg = (error as Error).message
    if (msg === 'BOOK_LOCKED') {
      return res.status(403).json({ success: false, error: 'BOOK_LOCKED' })
    }
    if (msg === 'CHAT_LIMIT') {
      return res.status(429).json({ success: false, error: '对话额度已用完' })
    }
    internalError(res, error)
  }
}

export async function getHistoryHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    const { page, limit } = validatedQuery<ChatHistoryQuery>(res)

    const history = await getChatHistory(userId, page, limit)
    res.status(200).json({ success: true, data: history })
  } catch (error) {
    internalError(res, error)
  }
}

export async function getChatQuotaHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    const quota = await getChatRemaining(userId)
    res.status(200).json({ success: true, data: quota })
  } catch (error) {
    internalError(res, error)
  }
}
