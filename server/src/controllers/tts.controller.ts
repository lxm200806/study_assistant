import fs from 'fs'
import { Request, Response, NextFunction } from 'express'
import { getWordAudioPath } from '../services/tts.service'
import { parseTtsAccent, parseTtsGender } from '../services/tts-accent'
import { validatedQuery } from '../validation/validate'
import type { TtsQuery } from '../validation/schemas'

export async function getTtsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { word, accent, gender } = validatedQuery<TtsQuery>(res)
    const filePath = await getWordAudioPath(
      word,
      parseTtsAccent(accent),
      parseTtsGender(gender)
    )
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

    const stream = fs.createReadStream(filePath)
    stream.on('error', next)
    stream.pipe(res)
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_WORD') {
      return res.status(400).json({ error: 'Invalid word' })
    }
    if (error instanceof Error && error.message === 'TTS_SYNTHESIS_FAILED') {
      return res.status(422).json({ error: 'TTS synthesis failed' })
    }
    next(error)
  }
}
