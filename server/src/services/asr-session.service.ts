import { randomUUID } from 'crypto'
import { isXfyunAsrConfigured } from './llm-config.service'
import { createXfyunSession, type XfyunAudioEncoding, XfyunAsrSession } from './asr-xfyun.service'
import { transcribeAudio } from './speech.service'

const SESSION_TTL_MS = 5 * 60 * 1000

interface AsrSessionEntry {
  userId: string
  provider: 'xfyun' | 'whisper'
  encoding: XfyunAudioEncoding
  xfyun?: XfyunAsrSession
  audioChunks: Buffer[]
  partialText: string
  createdAt: number
}

const sessions = new Map<string, AsrSessionEntry>()

function cleanupSessions(): void {
  const now = Date.now()
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id)
    }
  }
}

export async function startAsrSession(
  userId: string,
  encoding: XfyunAudioEncoding = 'lame'
): Promise<{ sessionId: string; provider: string }> {
  cleanupSessions()
  const sessionId = randomUUID()
  const provider = isXfyunAsrConfigured() ? 'xfyun' : 'whisper'

  const entry: AsrSessionEntry = {
    userId,
    provider,
    encoding,
    audioChunks: [],
    partialText: '',
    createdAt: Date.now()
  }

  if (provider === 'xfyun') {
    try {
      const xfyun = createXfyunSession(encoding)
      await xfyun.connect()
      entry.xfyun = xfyun
    } catch (error) {
      console.error('[asr-session] xfyun connect failed:', (error as Error).message)
      entry.provider = 'whisper'
    }
  }

  sessions.set(sessionId, entry)
  return { sessionId, provider: entry.provider }
}

export async function pushAsrChunk(
  userId: string,
  sessionId: string,
  audioBase64: string,
  isLast = false
): Promise<{ partial: string; isFinal: boolean }> {
  const session = sessions.get(sessionId)
  if (!session || session.userId !== userId) {
    throw new Error('ASR_SESSION_NOT_FOUND')
  }

  const buffer = Buffer.from(audioBase64, 'base64')
  if (buffer.length > 0) {
    session.audioChunks.push(buffer)
  }

  if (session.provider === 'xfyun' && session.xfyun) {
    session.xfyun.sendAudioChunk(audioBase64, isLast)
    await new Promise(r => setTimeout(r, isLast ? 800 : 80))
    session.partialText = session.xfyun.getPartialText()
    return { partial: session.partialText, isFinal: isLast }
  }

  if (isLast) {
    const combined = Buffer.concat(session.audioChunks)
    const result = await transcribeAudio(
      userId,
      combined.toString('base64'),
      session.encoding === 'raw' ? 'audio/L16;rate=16000' : 'audio/mp3'
    )
    session.partialText = result.text
    sessions.delete(sessionId)
    return { partial: session.partialText, isFinal: true }
  }

  return { partial: session.partialText, isFinal: false }
}

export async function endAsrSession(userId: string, sessionId: string): Promise<string> {
  const session = sessions.get(sessionId)
  if (!session || session.userId !== userId) {
    throw new Error('ASR_SESSION_NOT_FOUND')
  }

  if (session.provider === 'xfyun' && session.xfyun) {
    session.xfyun.sendAudioChunk('', true)
    session.partialText = await session.xfyun.close()
    sessions.delete(sessionId)
    return session.partialText
  }

  if (session.partialText) {
    sessions.delete(sessionId)
    return session.partialText
  }

  const combined = Buffer.concat(session.audioChunks)
  if (combined.length === 0) {
    sessions.delete(sessionId)
    return ''
  }

  const result = await transcribeAudio(
    userId,
    combined.toString('base64'),
    session.encoding === 'raw' ? 'audio/L16;rate=16000' : 'audio/mp3'
  )
  sessions.delete(sessionId)
  return result.text
}
