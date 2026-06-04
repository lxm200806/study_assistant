import fs from 'fs'
import { Request, Response, NextFunction } from 'express'
import { getWordAudioPath } from '../services/tts.service'

export async function getTtsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const word = String(req.query.word || '').trim()
    if (!word) {
      return res.status(400).json({ error: 'word is required' })
    }

    const filePath = await getWordAudioPath(word)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

    const stream = fs.createReadStream(filePath)
    stream.on('error', next)
    stream.pipe(res)
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_WORD') {
      return res.status(400).json({ error: 'Invalid word' })
    }
    next(error)
  }
}
