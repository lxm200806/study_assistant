import { Request, Response } from 'express'
import { studyUserId } from '../middleware/auth'
import {
  clampCount,
  parseTypingMode,
  parseTypingSource,
  REJECT_TEXT,
  type RejectReason
} from '../services/typing-logic'
import {
  createPracticeArticle,
  deletePracticeArticle,
  getDueArticleSentences,
  getPracticeArticle,
  listPracticeArticles,
  submitSentenceAnswer
} from '../services/typing-article.service'
import {
  createPracticeList,
  deletePracticeList,
  getTypingQueue,
  getTypingSummary,
  listPracticeLists,
  recordTypingActivity,
  submitTypingAnswer,
  updateTypingMark
} from '../services/typing.service'

function studyOrReply(req: Request, res: Response) {
  try {
    return studyUserId(req)
  } catch (error) {
    res.status(409).json({ success: false, error: (error as Error).message })
    return null
  }
}

function sendTypingError(res: Response, error: unknown) {
  const message = (error as Error).message
  if (message === 'BOOK_LOCKED') {
    return res.status(403).json({ success: false, error: '当前词书需开通会员后使用' })
  }
  if (message === 'Book not found' || message === 'NOT_FOUND') {
    return res.status(404).json({ success: false, error: '没有找到内容' })
  }
  if (message === 'WORD_NOT_FOUND') {
    return res.status(404).json({ success: false, error: '单词不存在' })
  }
  if (message === 'BOOK_REQUIRED' || message === 'LIST_REQUIRED' || message === 'BAD_INPUT') {
    const rejected = (error as { rejected?: Array<{ token: string; reason: RejectReason }> }).rejected
    const detail = rejected?.length
      ? `：${rejected.slice(0, 6).map(item => `${item.token}（${REJECT_TEXT[item.reason] || item.reason}）`).join('、')}`
      : ''
    return res.status(400).json({
      success: false,
      error: `请检查练习内容${detail}`,
      ...(rejected ? { rejected } : {})
    })
  }
  return res.status(500).json({ success: false, error: message })
}

export async function typingSummaryHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const bookCode = String(req.query.bookCode || '')
    if (!bookCode) return res.status(400).json({ success: false, error: 'bookCode is required' })
    const mode = parseTypingMode(req.query.mode)
    if (!mode) return res.status(400).json({ success: false, error: 'unknown mode' })
    const data = await getTypingSummary(learnerId, bookCode, mode)
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingQueueHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const source = parseTypingSource(req.query.source || 'smart')
    if (!source) return res.status(400).json({ success: false, error: 'unknown source' })
    const mode = parseTypingMode(req.query.mode)
    if (!mode) return res.status(400).json({ success: false, error: 'unknown mode' })
    const data = await getTypingQueue(learnerId, {
      bookCode: req.query.bookCode ? String(req.query.bookCode) : undefined,
      source,
      mode,
      count: clampCount(req.query.count, 20),
      listId: req.query.listId ? String(req.query.listId) : undefined
    })
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingAnswerHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const { wordId, isCorrect, mode: rawMode } = req.body as { wordId?: string; isCorrect?: boolean; mode?: string }
    const mode = parseTypingMode(rawMode)
    if (!wordId || typeof isCorrect !== 'boolean' || !mode) {
      return res.status(400).json({ success: false, error: 'Invalid request body' })
    }
    const data = await submitTypingAnswer(learnerId, wordId, isCorrect, mode)
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingMarkHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const { wordId, favorite, skipMastered } = req.body as {
      wordId?: string
      favorite?: boolean
      skipMastered?: boolean
    }
    if (!wordId || (favorite !== undefined && typeof favorite !== 'boolean') || (skipMastered !== undefined && typeof skipMastered !== 'boolean')) {
      return res.status(400).json({ success: false, error: 'Invalid request body' })
    }
    const data = await updateTypingMark(learnerId, wordId, { favorite, skipMastered })
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingActivityHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const count = Number((req.body as { count?: number }).count)
    if (!Number.isFinite(count)) {
      return res.status(400).json({ success: false, error: 'Invalid request body' })
    }
    const data = await recordTypingActivity(learnerId, count)
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingListsHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const data = await listPracticeLists(learnerId)
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingCreateListHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const { name, text } = req.body as { name?: string; text?: string }
    const data = await createPracticeList(learnerId, name, text)
    res.status(201).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingDeleteListHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    await deletePracticeList(learnerId, req.params.id)
    res.status(200).json({ success: true })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingArticlesHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const data = await listPracticeArticles(learnerId)
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingCreateArticleHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const data = await createPracticeArticle(learnerId, req.body || {})
    res.status(201).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingArticleHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const data = await getPracticeArticle(learnerId, req.params.id)
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingDeleteArticleHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    await deletePracticeArticle(learnerId, req.params.id)
    res.status(200).json({ success: true })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingDueArticlesHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const data = await getDueArticleSentences(learnerId, clampCount(req.query.count, 20))
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingArticleAnswerHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const { articleKey, sentenceIndex, isCorrect } = req.body as {
      articleKey?: string
      sentenceIndex?: number
      isCorrect?: boolean
    }
    if (!articleKey || typeof sentenceIndex !== 'number' || typeof isCorrect !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Invalid request body' })
    }
    const data = await submitSentenceAnswer(learnerId, articleKey, sentenceIndex, isCorrect)
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}
