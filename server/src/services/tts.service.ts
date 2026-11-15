import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { EdgeTTS } from 'edge-tts-universal'
import { isValidTtsText, sanitizeForTts, MAX_TTS_LENGTH } from '../utils/tts-text'
import { cacheSuffix, voiceForAccent, type TtsAccent } from './tts-accent'

const CACHE_DIR = path.join(__dirname, '../../data/tts-cache')

const pendingJobs = new Map<string, Promise<string>>()

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

function cacheFilePath(text: string, accent: TtsAccent): string {
  const trimmed = text.trim()
  const suffix = cacheSuffix(accent)
  if (trimmed.length <= 64 && /^[\w\s'.-]+$/i.test(trimmed)) {
    const safe = trimmed.toLowerCase().replace(/[^a-z0-9'.-]/gi, '_')
    return path.join(CACHE_DIR, `${safe}${suffix}`)
  }
  const hashSource = accent === 'us' ? trimmed.toLowerCase() : `uk\n${trimmed.toLowerCase()}`
  const hash = crypto.createHash('sha256').update(hashSource).digest('hex').slice(0, 32)
  return path.join(CACHE_DIR, `h_${hash}${suffix}`)
}

async function fetchYoudaoAudio(text: string, accent: TtsAccent): Promise<Buffer> {
  const type = accent === 'uk' ? 1 : 2
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text.trim())}&type=${type}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.youdao.com/'
      }
    })
    if (!res.ok) throw new Error('TTS_SYNTHESIS_FAILED')
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length < 200) throw new Error('TTS_SYNTHESIS_FAILED')
    return buffer
  } finally {
    clearTimeout(timer)
  }
}

async function synthesizeEdge(text: string, voice: string): Promise<Buffer> {
  const tts = new EdgeTTS(text.trim(), voice, { rate: '-5%' })
  const result = await Promise.race([
    tts.synthesize(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TTS_SYNTHESIS_FAILED')), 10000)
    )
  ])
  const buffer = Buffer.from(await result.audio.arrayBuffer())
  if (buffer.length === 0) throw new Error('TTS_SYNTHESIS_FAILED')
  return buffer
}

async function synthesizeToFile(text: string, filePath: string, voice: string, accent: TtsAccent): Promise<void> {
  try {
    let buffer: Buffer
    try {
      // Prefer Youdao (same as TypeWords) — Edge TTS often hangs when blocked
      buffer = await fetchYoudaoAudio(text, accent)
    } catch {
      buffer = await synthesizeEdge(text, voice)
    }
    await fs.promises.writeFile(filePath, buffer)
  } catch {
    throw new Error('TTS_SYNTHESIS_FAILED')
  }
}

export async function getWordAudioPath(word: string, accent: TtsAccent = 'us'): Promise<string> {
  const normalized = sanitizeForTts(word)
  if (!isValidTtsText(normalized)) {
    throw new Error('INVALID_WORD')
  }

  ensureCacheDir()
  const filePath = cacheFilePath(normalized, accent)
  if (fs.existsSync(filePath)) {
    return filePath
  }

  const key = filePath
  const existing = pendingJobs.get(key)
  if (existing) return existing

  const job = synthesizeToFile(normalized, filePath, voiceForAccent(accent), accent)
    .then(() => filePath)
    .finally(() => pendingJobs.delete(key))

  pendingJobs.set(key, job)
  return job
}

export function getTtsVoice(): string {
  return voiceForAccent('us')
}

export function getMaxTtsLength(): number {
  return MAX_TTS_LENGTH
}
