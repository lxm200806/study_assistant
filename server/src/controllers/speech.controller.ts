import { Request, Response } from 'express'
import { transcribeAudio, assessPronunciation } from '../services/speech.service'
import { startAsrSession, pushAsrChunk, endAsrSession } from '../services/asr-session.service'
import { getAsrProvider } from '../services/llm-config.service'

export async function getAsrConfigHandler(_req: Request, res: Response) {
  res.status(200).json({
    success: true,
    data: { provider: getAsrProvider() }
  })
}

export async function startAsrSessionHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const result = await startAsrSession(userId)
    res.status(200).json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function pushAsrChunkHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { sessionId, audioBase64, isLast } = req.body as {
      sessionId?: string
      audioBase64?: string
      isLast?: boolean
    }
    if (!sessionId || !audioBase64) {
      return res.status(400).json({ success: false, error: 'sessionId and audioBase64 are required' })
    }
    const result = await pushAsrChunk(userId, sessionId, audioBase64, !!isLast)
    res.status(200).json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function endAsrSessionHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { sessionId } = req.body as { sessionId?: string }
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required' })
    }
    const text = await endAsrSession(userId, sessionId)
    res.status(200).json({ success: true, data: { text } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function transcribeHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { audioBase64, mimeType } = req.body as { audioBase64?: string; mimeType?: string }

    if (!audioBase64) {
      return res.status(400).json({ success: false, error: 'audioBase64 is required' })
    }

    const result = await transcribeAudio(userId, audioBase64, mimeType || 'audio/mp3')
    res.status(200).json({ success: true, data: result })
  } catch (error) {
    const msg = (error as Error).message
    const status = msg === 'SPEECH_LIMIT' ? 429 : msg === 'WHISPER_NOT_CONFIGURED' ? 503 : 500
    const errorText = msg === 'SPEECH_LIMIT'
      ? '今日免费语音识别次数已用完'
      : msg === 'WHISPER_NOT_CONFIGURED'
        ? '语音识别服务未配置'
        : msg
    res.status(status).json({ success: false, error: errorText })
  }
}

export async function assessHandler(req: Request, res: Response) {
  try {
    const userId = req.userId!
    const { referenceText, audioBase64, mimeType } = req.body as {
      referenceText?: string
      audioBase64?: string
      mimeType?: string
    }

    if (!referenceText || !audioBase64) {
      return res.status(400).json({ success: false, error: 'referenceText and audioBase64 are required' })
    }

    const result = await assessPronunciation(userId, referenceText, audioBase64, mimeType || 'audio/mp3')
    res.status(200).json({ success: true, data: result })
  } catch (error) {
    const msg = (error as Error).message
    const status = msg === 'SPEECH_LIMIT' ? 429 : msg === 'WHISPER_NOT_CONFIGURED' ? 503 : 500
    res.status(status).json({ success: false, error: msg })
  }
}
