import prisma from '../prisma/client'
import { isXfyunAsrConfigured } from './llm-config.service'
import { transcribeWithXfyun, type XfyunAudioEncoding } from './asr-xfyun.service'
import { getBillingUser } from './billing-user'
import { consumeQuota, refundQuota } from '../entitlements/entitlement.service'
import { PERMISSIONS } from '../entitlements/permissions'

function passThreshold(): number {
  return Number(process.env.SPEECH_PASS_THRESHOLD || 70)
}

export interface TranscribeResult {
  text: string
}

export interface AssessResult {
  transcript: string
  score: number
  passed: boolean
  feedback: string
}

export function normalizeSpeechText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function computeSpeechScore(referenceText: string, transcript: string): number {
  const ref = normalizeSpeechText(referenceText)
  const trans = normalizeSpeechText(transcript)
  if (!ref || !trans) return 0

  const refWords = ref.split(' ').filter(Boolean)
  const transWords = new Set(trans.split(' ').filter(Boolean))
  if (refWords.length === 0) return 0

  const overlap = refWords.filter(w => transWords.has(w)).length
  const wordScore = Math.round((overlap / refWords.length) * 100)

  const maxLen = Math.max(ref.length, trans.length)
  const distance = levenshtein(ref, trans)
  const charScore = maxLen > 0 ? Math.round((1 - distance / maxLen) * 100) : 0

  return Math.max(0, Math.min(100, Math.round(wordScore * 0.7 + charScore * 0.3)))
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[a.length][b.length]
}

function audioExtension(mimeType: string): string {
  const lower = mimeType.toLowerCase()
  if (lower.includes('wav')) return 'wav'
  if (lower.includes('webm')) return 'webm'
  if (lower.includes('ogg')) return 'ogg'
  if (lower.includes('mp4') || lower.includes('m4a')) return 'm4a'
  return 'mp3'
}

function getWhisperConfig(): { apiKey: string; baseUrl: string } | null {
  if (process.env.WHISPER_API_KEY) {
    return {
      apiKey: process.env.WHISPER_API_KEY,
      baseUrl: (process.env.WHISPER_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
    }
  }
  if (process.env.WHISPER_BASE_URL && process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.WHISPER_BASE_URL.replace(/\/$/, '')
    }
  }
  // Avoid sending Whisper requests to chat-only proxies (e.g. LM Studio)
  if (process.env.OPENAI_API_KEY && !process.env.LLM_BASE_URL) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1'
    }
  }
  return null
}

function xfyunEncodingFromMime(mimeType: string): XfyunAudioEncoding {
  return mimeType.toLowerCase().includes('l16') ? 'raw' : 'lame'
}

function isBrowserFriendlyMime(mimeType: string): boolean {
  const lower = mimeType.toLowerCase()
  return lower.includes('webm') || lower.includes('ogg') || lower.includes('mp4') || lower.includes('m4a')
}

/** 按账号语音评测额度扣减一次，并保留一条用量流水用于释放/审计。 */
export async function reserveSpeechUsage(userId: string, kind: string): Promise<string | null> {
  const account = await getBillingUser(userId)
  if (!account) throw new Error('SPEECH_LIMIT')

  try {
    await consumeQuota(account.id, PERMISSIONS.AI_SPEECH_ASSESS, 1, { scopeId: 'account' })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'QUOTA_EXCEEDED' || message === 'PERMISSION_DENIED') {
      throw new Error('SPEECH_LIMIT')
    }
    throw error
  }

  const row = await prisma.speechUsageLog.create({ data: { learnerId: userId, kind } })
  return row.id
}

export async function releaseSpeechUsage(usageId: string | null): Promise<void> {
  if (!usageId) return
  const row = await prisma.speechUsageLog.findUnique({
    where: { id: usageId },
    select: { learnerId: true }
  })
  await prisma.speechUsageLog.delete({ where: { id: usageId } }).catch(() => undefined)
  if (!row) return
  const account = await getBillingUser(row.learnerId)
  if (account) {
    await refundQuota(account.id, PERMISSIONS.AI_SPEECH_ASSESS, 1, { scopeId: 'account' }).catch(
      () => undefined
    )
  }
}

export async function transcribeAudio(userId: string, audioBase64: string, mimeType = 'audio/mp3'): Promise<TranscribeResult> {
  const buffer = Buffer.from(audioBase64, 'base64')
  if (buffer.length === 0) {
    throw new Error('EMPTY_AUDIO')
  }
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('AUDIO_TOO_LARGE')
  }

  // Browser H5 recordings are often WebM/Opus; keep them on the Whisper path.
  const useXfyun = isXfyunAsrConfigured() && !isBrowserFriendlyMime(mimeType)
  const config = getWhisperConfig()
  if (!useXfyun && !config) {
    throw new Error('WHISPER_NOT_CONFIGURED')
  }

  const reservation = await reserveSpeechUsage(userId, 'transcribe')
  try {
    if (useXfyun) {
      try {
        const text = await transcribeWithXfyun(audioBase64, xfyunEncodingFromMime(mimeType))
        return { text }
      } catch (error) {
        console.error('[speech] xfyun transcribe failed:', (error as Error).message)
      }
    }

    if (!config) {
      throw new Error('WHISPER_NOT_CONFIGURED')
    }

    const ext = audioExtension(mimeType)
    const blob = new Blob([buffer], { type: mimeType })
    const form = new FormData()
    form.append('file', blob, `audio.${ext}`)
    form.append('model', process.env.WHISPER_MODEL || 'whisper-1')
    form.append('language', 'en')

    const res = await fetch(`${config.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(60_000),
      body: form
    })

    if (!res.ok) {
      throw new Error('TRANSCRIBE_FAILED')
    }

    const data = await res.json() as { text?: string }
    return { text: (data.text || '').trim() }
  } catch (error) {
    await releaseSpeechUsage(reservation)
    throw error
  }
}

export async function assessPronunciation(
  userId: string,
  referenceText: string,
  audioBase64: string,
  mimeType = 'audio/mp3'
): Promise<AssessResult> {
  let transcript = ''
  try {
    const result = await transcribeAudio(userId, audioBase64, mimeType)
    transcript = result.text
  } catch (err) {
    const msg = (err as Error).message
    // Only quota errors should block the request entirely.
    if (msg === 'SPEECH_LIMIT') throw err
    console.error('[assess] transcription failed, using fallback:', msg)
    return {
      transcript: '',
      score: 0,
      passed: false,
      feedback: msg === 'WHISPER_NOT_CONFIGURED'
        ? '语音识别未配置，请手动自评。'
        : '语音识别暂时不可用，请手动自评。'
    }
  }

  const score = computeSpeechScore(referenceText, transcript)
  const passed = score >= passThreshold()

  let feedback = passed
    ? '发音不错，继续保持！'
    : '再听标准发音，注意单词清晰度和重音。'
  if (!transcript) {
    feedback = '未能识别到语音，请靠近麦克风再试。'
  }

  return { transcript, score, passed, feedback }
}

export function getPassThreshold(): number {
  return passThreshold()
}
