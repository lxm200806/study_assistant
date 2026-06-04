import fs from 'fs'
import path from 'path'
import { EdgeTTS } from 'edge-tts-universal'

const DEFAULT_VOICE = process.env.TTS_VOICE || 'en-US-JennyNeural'
const CACHE_DIR = path.join(__dirname, '../../data/tts-cache')

const pendingJobs = new Map<string, Promise<string>>()

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase()
}

function isValidWord(word: string): boolean {
  const text = word.trim()
  return text.length > 0 && text.length <= 64 && /^[\w\s'.-]+$/i.test(text)
}

function cacheFilePath(word: string): string {
  const safe = normalizeWord(word).replace(/[^a-z0-9'.-]/gi, '_')
  return path.join(CACHE_DIR, `${safe}.mp3`)
}

async function synthesizeToFile(word: string, filePath: string): Promise<void> {
  const tts = new EdgeTTS(word.trim(), DEFAULT_VOICE, { rate: '-5%' })
  const result = await tts.synthesize()
  const buffer = Buffer.from(await result.audio.arrayBuffer())
  await fs.promises.writeFile(filePath, buffer)
}

export async function getWordAudioPath(word: string): Promise<string> {
  if (!isValidWord(word)) {
    throw new Error('INVALID_WORD')
  }

  ensureCacheDir()
  const filePath = cacheFilePath(word)
  if (fs.existsSync(filePath)) {
    return filePath
  }

  const key = cacheFilePath(word)
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
