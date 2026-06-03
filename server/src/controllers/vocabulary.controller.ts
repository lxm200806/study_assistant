import { Request, Response } from 'express'
import { getVocabulary, getVocabularyById, getRandomVocabulary, getTrainingStats } from '../services/vocabulary.service'
import { getEmoji } from '../utils/emojiMap'

export async function getVocabularyListHandler(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    
    const words = await getVocabulary(page, limit)
    
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
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getVocabularyDetailHandler(req: Request, res: Response) {
  try {
    const { id } = req.params
    
    const word = await getVocabularyById(id)
    
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
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getRandomWordsHandler(req: Request, res: Response) {
  try {
    const count = parseInt(req.query.count as string) || 10
    
    const words = await getRandomVocabulary(count)
    
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
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getStatsHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    
    const stats = await getTrainingStats(userId)
    res.status(200).json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}