import { Request, Response } from 'express'
import { practice, getReviewWords, getTrainingHistory } from '../services/training.service'
import { markWordsPracticed, getNewlyCoveredCount } from '../services/coverage.service'

export async function practiceHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { wordId, type, isCorrect } = req.body
    
    if (!wordId || !type || typeof isCorrect !== 'boolean') {
      return res.status(400).json({ error: 'Invalid request body' })
    }
    
    const result = await practice(userId, { wordId, type, isCorrect })
    res.status(200).json(result)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}

export async function getReviewHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    
    const words = await getReviewWords(userId)
    res.status(200).json(words)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}

export async function getHistoryHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    
    const history = await getTrainingHistory(userId, page, limit)
    res.status(200).json(history)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}

export async function completeSessionHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { bookCode, wordIds } = req.body as { bookCode?: string; wordIds?: string[] }

    if (!bookCode || !Array.isArray(wordIds)) {
      return res.status(400).json({ error: 'bookCode and wordIds are required' })
    }

    const newlyCovered = await getNewlyCoveredCount(userId, bookCode, wordIds)
    await markWordsPracticed(userId, bookCode, wordIds)

    res.status(200).json({ success: true, newlyCovered })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}