import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { EdgeTTS } from 'edge-tts-universal'

const DEFAULT_VOICE = process.env.TTS_VOICE || 'en-US-JennyNeural'
const CACHE_DIR = path.join(__dirname, '../../data/tts-cache')
const MAX_TTS_LENGTH = 120

const pendingJobs = new Map<string, Promise<string>>()

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

function isValidTtsText(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_TTS_LENGTH && /^[\w\s'.,!?;:"()\-]+$/i.test(trimmed)
}

function cacheFilePath(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= 64 && /^[\w\s'.-]+$/i.test(trimmed)) {
    const safe = trimmed.toLowerCase().replace(/[^a-z0-9'.-]/gi, '_')
    return path.join(CACHE_DIR, `${safe}.mp3`)
  }
  const hash = crypto.createHash('sha256').update(trimmed.toLowerCase()).digest('hex').slice(0, 32)
  return path.join(CACHE_DIR, `h_${hash}.mp3`)
}

async function synthesizeToFile(text: string, filePath: string): Promise<void> {
  const tts = new EdgeTTS(text.trim(), DEFAULT_VOICE, { rate: '-5%' })
  const result = await tts.synthesize()
  const buffer = Buffer.from(await result.audio.arrayBuffer())
  await fs.promises.writeFile(filePath, buffer)
}

export async function getWordAudioPath(word: string): Promise<string> {
  if (!isValidTtsText(word)) {
    throw new Error('INVALID_WORD')
  }

  ensureCacheDir()
  const filePath = cacheFilePath(word)
  if (fs.existsSync(filePath)) {
    return filePath
  }

  const key = filePath
  const existing = pendingJobs.get(key)
  if (existing) return existing

  const job = synthesizeToFile(word, filePath)
    .then(() => filePath)
    .finally(() => pendingJobs.delete(key))

  pendingJobs.set(key, job)
  return job
}

export function getTtsVoice(): string {
  return DEFAULT_VOICE
}

export function getMaxTtsLength(): number {
  return MAX_TTS_LENGTH
}
