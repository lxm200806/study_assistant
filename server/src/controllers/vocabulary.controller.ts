import { Request, Response } from 'express'
import { getVocabulary, getVocabularyById, getRandomVocabulary, getTrainingStats } from '../services/vocabulary.service'
import { getEmoji } from '../utils/emojiMap'
import { internalError } from '../utils/http-errors'
import { validatedQuery } from '../validation/validate'
import type { RandomCountQuery, VocabListQuery } from '../validation/schemas'

export async function getVocabularyListHandler(req: Request, res: Response) {
  try {
    const { page, limit } = validatedQuery<VocabListQuery>(res)

    const words = await getVocabulary(page, limit, req.learnerId)
    
    const formattedWords = words.map(word => ({
      id: word.id,
      word: word.word,
      meaning: word.meaning,
      phonetic: word.phonetic || '',
      image: getEmoji(word.word),
      imageUrl: word.imageUrl,
      example: word.exampleSentence
    }))
    
    res.status(200).json({ success: true, data: formattedWords })
  } catch (error) {
    internalError(res, error)
  }
}

export async function getVocabularyDetailHandler(req: Request, res: Response) {
  try {
    const { id } = req.params

    const word = await getVocabularyById(id, req.learnerId)
    
    if (!word) {
      return res.status(404).json({ success: false, error: 'Word not found' })
    }
    
    const formattedWord = {
      id: word.id,
      word: word.word,
      meaning: word.meaning,
      phonetic: word.phonetic || '',
      image: getEmoji(word.word),
      imageUrl: word.imageUrl,
      example: word.exampleSentence
    }
    
    res.status(200).json({ success: true, data: formattedWord })
  } catch (error) {
    internalError(res, error)
  }
}

export async function getRandomWordsHandler(req: Request, res: Response) {
  try {
    const { count } = validatedQuery<RandomCountQuery>(res)

    const words = await getRandomVocabulary(count, req.learnerId)
    
    const formattedWords = words.map(word => ({
      id: word.id,
      word: word.word,
      meaning: word.meaning,
      phonetic: word.phonetic || '',
      image: getEmoji(word.word),
      imageUrl: word.imageUrl,
      example: word.exampleSentence
    }))
    
    res.status(200).json({ success: true, data: formattedWords })
  } catch (error) {
    internalError(res, error)
  }
}

export async function getStatsHandler(req: Request, res: Response) {
  try {
    const userId = req.learnerId
    if (!userId) return res.status(409).json({ success: false, error: '请先添加学生' })
    
    const stats = await getTrainingStats(userId)
    res.status(200).json({ success: true, data: stats })
  } catch (error) {
    internalError(res, error)
  }
}
