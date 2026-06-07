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
  chunkCount: number
}

const sessions = new Map<string, AsrSessionEntry>()

function debugAsrSession(event: string, payload: Record<string, unknown>): void {
  console.debug('[VoiceASR:server]', { event, ...payload })
}

function shortSessionId(sessionId: string): string {
  return sessionId.slice(0, 8)
}

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
    createdAt: Date.now(),
    chunkCount: 0
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
  debugAsrSession('session-start', {
    sessionId: shortSessionId(sessionId),
    provider: entry.provider,
    encoding
  })
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
  session.chunkCount += 1
  const chunkNo = session.chunkCount
  const elapsedMs = Date.now() - session.createdAt
  if (buffer.length > 0) {
    session.audioChunks.push(buffer)
  }

  if (session.provider === 'xfyun' && session.xfyun) {
    session.xfyun.sendAudioChunk(audioBase64, isLast)
    await new Promise(r => setTimeout(r, isLast ? 800 : 80))
    session.partialText = session.xfyun.getPartialText()
    debugAsrSession(session.partialText ? 'xfyun-partial' : 'xfyun-no-partial-yet', {
      sessionId: shortSessionId(sessionId),
      chunkNo,
      elapsedMs,
      bytes: buffer.length,
      isLast,
      partial: session.partialText
    })
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
    debugAsrSession('whisper-final-on-last-chunk', {
      sessionId: shortSessionId(sessionId),
      chunkNo,
      elapsedMs,
      bytes: buffer.length,
      text: session.partialText
    })
    return { partial: session.partialText, isFinal: true }
  }

  if (chunkNo % 10 === 0) {
    debugAsrSession('whisper-buffering-no-streaming-partial', {
      sessionId: shortSessionId(sessionId),
      chunkNo,
      elapsedMs,
      bufferedChunks: session.audioChunks.length,
      bufferedBytes: Buffer.concat(session.audioChunks).length
    })
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
    debugAsrSession('session-end-xfyun-final', {
      sessionId: shortSessionId(sessionId),
      elapsedMs: Date.now() - session.createdAt,
      chunkCount: session.chunkCount,
      text: session.partialText
    })
    return session.partialText
  }

  if (session.partialText) {
    sessions.delete(sessionId)
    debugAsrSession('session-end-existing-final', {
      sessionId: shortSessionId(sessionId),
      elapsedMs: Date.now() - session.createdAt,
      chunkCount: session.chunkCount,
      text: session.partialText
    })
    return session.partialText
  }

  const combined = Buffer.concat(session.audioChunks)
  if (combined.length === 0) {
    sessions.delete(sessionId)
    debugAsrSession('session-end-empty-audio', {
      sessionId: shortSessionId(sessionId),
      elapsedMs: Date.now() - session.createdAt,
      chunkCount: session.chunkCount
    })
    return ''
  }

  const result = await transcribeAudio(
    userId,
    combined.toString('base64'),
    session.encoding === 'raw' ? 'audio/L16;rate=16000' : 'audio/mp3'
  )
  sessions.delete(sessionId)
  debugAsrSession('session-end-whisper-final', {
    sessionId: shortSessionId(sessionId),
    elapsedMs: Date.now() - session.createdAt,
    chunkCount: session.chunkCount,
    bytes: combined.length,
    text: result.text
  })
  return result.text
}
