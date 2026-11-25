import { Request, Response } from 'express'
import { studyUserId } from '../middleware/auth'
import { signSessionToken } from '../services/session-token'
import {
  clampCount,
  parseHistoryDate,
  parseTypingMode,
  REJECT_TEXT,
  type RejectReason
} from '../services/typing-logic'
import { internalError } from '../utils/http-errors'
import { validatedQuery } from '../validation/validate'
import type { TypingQueueQuery, TypingSummaryQuery } from '../validation/schemas'
import {
  createPracticeArticle,
  deletePracticeArticle,
  getDueArticleSentences,
  getPracticeArticle,
  listPracticeArticles,
  previewArticleEdit,
  submitSentenceAnswer,
  updatePracticeArticle
} from '../services/typing-article.service'
import {
  createPracticeList,
  deletePracticeList,
  getTypingHistory,
  getTypingQueue,
  getTypingSummary,
  listPracticeLists,
  recordTypingActivity,
  recordTypingSession,
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
  return internalError(res, error)
}

export async function typingSummaryHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const { bookCode, mode } = validatedQuery<TypingSummaryQuery>(res)
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
    const query = validatedQuery<TypingQueueQuery>(res)
    const data = await getTypingQueue(learnerId, {
      bookCode: query.bookCode,
      source: query.source,
      mode: query.mode,
      count: query.count,
      listId: query.listId,
      includeMastered: query.includeMastered === '1' || query.includeMastered === 'true',
      allBooks: query.allBooks === '1' || query.allBooks === 'true'
    })
    // 按书取词时同样签发词表凭证，拼读练习结束会用它完成词汇会话。
    const sessionToken =
      data.scopedToBook && data.bookCode && data.words.length
        ? signSessionToken(
            learnerId,
            data.bookCode,
            data.words.map(word => word.id)
          )
        : undefined
    res.status(200).json({ success: true, data: { ...data, sessionToken } })
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

export async function typingUpdateArticleHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const data = await updatePracticeArticle(learnerId, req.params.id, req.body || {})
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingPreviewArticleHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const data = await previewArticleEdit(learnerId, req.params.id, req.body || {})
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingHistoryHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const end = parseHistoryDate(req.query.end)
    if (!end) return res.status(400).json({ success: false, error: '请检查练习内容' })
    const requested = Number(req.query.days)
    const days = Number.isFinite(requested) ? Math.min(140, Math.max(7, Math.floor(requested))) : 112
    const data = await getTypingHistory(learnerId, end, days)
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingSessionHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const data = await recordTypingSession(learnerId, req.body || {})
    res.status(201).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}

export async function typingArticleAnswerHandler(req: Request, res: Response) {
  try {
    const learnerId = studyOrReply(req, res)
    if (!learnerId) return
    const { articleKey, sentenceIndex, isCorrect, linear } = req.body as {
      articleKey?: string
      sentenceIndex?: number
      isCorrect?: boolean
      linear?: boolean
    }
    if (!articleKey || typeof sentenceIndex !== 'number' || typeof isCorrect !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Invalid request body' })
    }
    const data = await submitSentenceAnswer(learnerId, articleKey, sentenceIndex, isCorrect, linear === true)
    res.status(200).json({ success: true, data })
  } catch (error) {
    sendTypingError(res, error)
  }
}
