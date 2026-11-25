import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { EdgeTTS } from 'edge-tts-universal'
import { isValidTtsText, sanitizeForTts, MAX_TTS_LENGTH } from '../utils/tts-text'
import {
  cacheSuffix,
  voiceForAccent,
  type TtsAccent,
  type TtsGender
} from './tts-accent'

const CACHE_DIR = path.join(__dirname, '../../data/tts-cache')
const MAX_CACHE_FILES = 3000
const PRUNE_EVERY_WRITES = 25

const pendingJobs = new Map<string, Promise<string>>()
let writesSincePrune = 0

async function pruneCache(): Promise<void> {
  try {
    const names = await fs.promises.readdir(CACHE_DIR)
    if (names.length <= MAX_CACHE_FILES) return
    const files = await Promise.all(
      names.map(async name => {
        const fullPath = path.join(CACHE_DIR, name)
        const stat = await fs.promises.stat(fullPath).catch(() => null)
        return stat?.isFile() ? { fullPath, mtime: stat.mtimeMs } : null
      })
    )
    const removable = files
      .filter((item): item is { fullPath: string; mtime: number } => !!item)
      .sort((a, b) => a.mtime - b.mtime)
    const removeCount = names.length - MAX_CACHE_FILES
    for (const item of removable.slice(0, removeCount)) {
      await fs.promises.unlink(item.fullPath).catch(() => undefined)
    }
  } catch {
    // ignore cache pruning errors
  }
}

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

function cacheFilePath(text: string, accent: TtsAccent, gender: TtsGender): string {
  const trimmed = text.trim()
  const suffix = cacheSuffix(accent, gender)
  if (trimmed.length <= 64 && /^[\w\s'.-]+$/i.test(trimmed)) {
    const safe = trimmed.toLowerCase().replace(/[^a-z0-9'.-]/gi, '_')
    return path.join(CACHE_DIR, `${safe}${suffix}`)
  }
  const hashSource = `${gender}\n${accent}\n${trimmed.toLowerCase()}`
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

/**
 * HaiCi (dict.cn) exposes real 男生版/女生版 dictionary clips.
 * Youdao dictvoice only has UK/US accent — no gender — so male words use HaiCi.
 */
async function fetchHaiciAudio(
  text: string,
  accent: TtsAccent,
  gender: TtsGender
): Promise<Buffer> {
  const word = text.trim().toLowerCase()
  const pageUrl = `https://dict.cn/${encodeURIComponent(word)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const pageRes = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://dict.cn/'
      }
    })
    if (!pageRes.ok) throw new Error('TTS_SYNTHESIS_FAILED')
    const html = await pageRes.text()

    const wantTitle = gender === 'male' ? '男生版发音' : '女生版发音'
    // Prefer accent-matched prefix: 英 fb/mb, 美 fu/mu (also fuk/muc variants)
    const preferPrefix =
      accent === 'uk'
        ? gender === 'male'
          ? ['mb', 'muc', 'mu']
          : ['fb', 'fuk', 'fu']
        : gender === 'male'
          ? ['mu', 'muc', 'mb']
          : ['fu', 'fuk', 'fb']

    const matches = [
      ...html.matchAll(/naudio="([^"]+)"[^>]*title="(男生版发音|女生版发音)"/g)
    ]
    if (!matches.length) throw new Error('TTS_SYNTHESIS_FAILED')

    const titled = matches
      .filter(m => m[2] === wantTitle)
      .map(m => m[1])
    const pool = titled.length ? titled : matches.map(m => m[1])

    let naudio = pool[0]
    for (const prefix of preferPrefix) {
      const hit = pool.find(p => p.toLowerCase().startsWith(prefix.toLowerCase()))
      if (hit) {
        naudio = hit
        break
      }
    }
    if (!naudio) throw new Error('TTS_SYNTHESIS_FAILED')

    const audioUrl = `https://audio.dict.cn/${naudio}`
    const audioRes = await fetch(audioUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://dict.cn/'
      }
    })
    if (!audioRes.ok) throw new Error('TTS_SYNTHESIS_FAILED')
    const buffer = Buffer.from(await audioRes.arrayBuffer())
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

async function synthesizeToFile(
  text: string,
  filePath: string,
  voice: string,
  accent: TtsAccent,
  gender: TtsGender
): Promise<void> {
  try {
    let buffer: Buffer
    try {
      if (gender === 'male') {
        // Youdao has no male/female — use HaiCi 男生版 for male words
        buffer = await fetchHaiciAudio(text, accent, 'male')
      } else {
        // Female / default: Youdao (same as TypeWords)
        buffer = await fetchYoudaoAudio(text, accent)
      }
    } catch {
      try {
        if (gender === 'female') {
          buffer = await fetchHaiciAudio(text, accent, 'female')
        } else {
          buffer = await fetchYoudaoAudio(text, accent)
        }
      } catch {
        buffer = await synthesizeEdge(text, voice)
      }
    }
    await fs.promises.writeFile(filePath, buffer)
    writesSincePrune += 1
    if (writesSincePrune >= PRUNE_EVERY_WRITES) {
      writesSincePrune = 0
      void pruneCache()
    }
  } catch {
    throw new Error('TTS_SYNTHESIS_FAILED')
  }
}

export async function getWordAudioPath(
  word: string,
  accent: TtsAccent = 'us',
  gender: TtsGender = 'female'
): Promise<string> {
  const normalized = sanitizeForTts(word)
  if (!isValidTtsText(normalized)) {
    throw new Error('INVALID_WORD')
  }

  ensureCacheDir()
  const filePath = cacheFilePath(normalized, accent, gender)
  if (fs.existsSync(filePath)) {
    return filePath
  }

  const key = filePath
  const existing = pendingJobs.get(key)
  if (existing) return existing

  const job = synthesizeToFile(
    normalized,
    filePath,
    voiceForAccent(accent, gender),
    accent,
    gender
  )
    .then(() => filePath)
    .finally(() => pendingJobs.delete(key))

  pendingJobs.set(key, job)
  return job
}

export function getTtsVoice(): string {
  return voiceForAccent('us', 'female')
}

export function getMaxTtsLength(): number {
  return MAX_TTS_LENGTH
}
