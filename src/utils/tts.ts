import { getApiBaseUrl } from '@/utils/api'
import { isBrowserH5 } from '@/utils/audio-recording'
import { splitTextForTts, isValidTtsText, sanitizeForTts, MAX_TTS_LENGTH } from '@/utils/tts-text'

let speaking = false
let activeAudio: UniApp.InnerAudioContext | null = null
let activeH5Audio: HTMLAudioElement | null = null
let ttsUnlocked = false
/** Bump on every new speak / stop — stale plays must not fallback or resume. */
let playbackGeneration = 0
const preloadStarted = new Set<string>()

const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

class PlaybackSupersededError extends Error {
  constructor() {
    super('playback superseded')
    this.name = 'PlaybackSupersededError'
  }
}

function isSuperseded(err: unknown): boolean {
  return err instanceof PlaybackSupersededError || (err as Error)?.name === 'PlaybackSupersededError'
}

/** Same as TypeWords: dict.youdao.com/dictvoice (type=2 US, type=1 UK) */
export function buildYoudaoUrl(word: string, accent: 'us' | 'uk' = 'us'): string {
  const cleaned = sanitizeForTts(word || '')
  const type = accent === 'uk' ? 1 : 2
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleaned)}&type=${type}`
}

function buildBackendTtsUrl(word: string, accent: 'us' | 'uk' = 'us'): string {
  const cleaned = sanitizeForTts(word || '')
  const base = `${getApiBaseUrl()}/tts?word=${encodeURIComponent(cleaned)}`
  return accent === 'uk' ? `${base}&accent=uk` : base
}

function buildTtsUrl(word: string, accent: 'us' | 'uk' = 'us'): string {
  if (isBrowserH5()) return buildYoudaoUrl(word, accent)
  return buildBackendTtsUrl(word, accent)
}

export function isSpeakableForTts(text: string, minLetters = 2): boolean {
  return isValidTtsText(text) && (text.match(/[a-zA-Z]/g) || []).length >= minLetters
}

export function isTtsSupported(): boolean {
  return typeof uni !== 'undefined' && typeof uni.createInnerAudioContext === 'function'
}

export function unlockTtsPlayback(): Promise<void> {
  if (!isBrowserH5() || ttsUnlocked) return Promise.resolve()

  const el = new Audio(SILENT_WAV)
  el.volume = 0.01
  return el
    .play()
    .then(() => {
      ttsUnlocked = true
    })
    .catch(async () => {
      try {
        const Ctx =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (Ctx) {
          const ctx = new Ctx()
          await ctx.resume()
          ttsUnlocked = true
        }
      } catch {
        // ignore
      }
    })
}

function destroyActiveAudio(): void {
  if (activeH5Audio) {
    const el = activeH5Audio
    activeH5Audio = null
    try {
      el.onended = null
      el.onerror = null
      el.pause()
      el.removeAttribute('src')
      el.load()
    } catch {
      // ignore
    }
  }
  if (!activeAudio) return
  try {
    activeAudio.stop()
    activeAudio.destroy()
  } catch {
    // ignore
  }
  activeAudio = null
}

export function stopSpeak(): void {
  playbackGeneration++
  destroyActiveAudio()
  speaking = false
}

function playUrlH5(url: string, generation: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (generation !== playbackGeneration) {
      reject(new PlaybackSupersededError())
      return
    }
    destroyActiveAudio()

    const el = new Audio(url)
    el.volume = 1
    activeH5Audio = el

    let settled = false
    const finish = (ok: boolean, err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (generation !== playbackGeneration) {
        speaking = false
        reject(new PlaybackSupersededError())
        return
      }
      speaking = false
      if (activeH5Audio === el) activeH5Audio = null
      if (ok) resolve()
      else reject(err || new Error('audio playback failed'))
    }

    el.addEventListener('ended', () => finish(true))
    el.addEventListener('error', () => {
      // src cleared by a newer play → superseded, not a real failure
      if (generation !== playbackGeneration) {
        finish(false, new PlaybackSupersededError())
        return
      }
      finish(false, new Error('audio playback failed'))
    })

    const timer = setTimeout(() => finish(false, new Error('audio timeout')), 15000)

    speaking = true
    const playPromise = el.play()
    if (playPromise !== undefined) {
      playPromise.catch((err: DOMException | Error) => {
        if (generation !== playbackGeneration || (err as DOMException).name === 'AbortError') {
          finish(false, new PlaybackSupersededError())
          return
        }
        finish(false, err instanceof Error ? err : new Error('audio playback failed'))
      })
    }
  })
}

function playUrlNative(url: string, generation: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (generation !== playbackGeneration) {
      reject(new PlaybackSupersededError())
      return
    }
    destroyActiveAudio()

    const audio = uni.createInnerAudioContext()
    activeAudio = audio

    let settled = false
    const finish = (ok: boolean, err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (generation !== playbackGeneration) {
        speaking = false
        try {
          audio.destroy()
        } catch {
          // ignore
        }
        reject(new PlaybackSupersededError())
        return
      }
      speaking = false
      if (activeAudio === audio) activeAudio = null
      try {
        audio.destroy()
      } catch {
        // ignore
      }
      if (ok) resolve()
      else reject(err || new Error('audio playback failed'))
    }

    audio.onEnded(() => finish(true))
    audio.onError(() => {
      if (generation !== playbackGeneration) {
        finish(false, new PlaybackSupersededError())
        return
      }
      finish(false, new Error('audio playback failed'))
    })

    const timer = setTimeout(() => finish(false, new Error('audio timeout')), 20000)

    speaking = true
    audio.src = url
    audio.play()
  })
}

function playUrl(url: string, generation: number): Promise<void> {
  if (isBrowserH5()) return playUrlH5(url, generation)
  return playUrlNative(url, generation)
}

export function preloadWordAudio(word: string): void {
  const text = sanitizeForTts(word || '')
  if (!text || preloadStarted.has(text.toLowerCase())) return

  preloadStarted.add(text.toLowerCase())
  if (isBrowserH5() && typeof Audio !== 'undefined') {
    try {
      const el = new Audio()
      el.preload = 'auto'
      el.src = buildYoudaoUrl(text)
    } catch {
      preloadStarted.delete(text.toLowerCase())
    }
    return
  }
  uni.request({
    url: buildBackendTtsUrl(text),
    method: 'GET',
    responseType: 'arraybuffer',
    timeout: 8000,
    fail: () => preloadStarted.delete(text.toLowerCase())
  })
}

export function speakWord(word: string, _lang = 'en-US'): Promise<void> {
  const text = sanitizeForTts(word || '', MAX_TTS_LENGTH)
  if (!text || !isSpeakableForTts(text, 1)) return Promise.reject(new Error('empty word'))
  if (!isTtsSupported()) return Promise.reject(new Error('TTS not supported'))
  return speakText(text, MAX_TTS_LENGTH, 'us')
}

export function getSpeakingState(): boolean {
  return speaking
}

export function getWordAudioUrl(word: string): string {
  return buildTtsUrl(word)
}

async function playWithFallback(text: string, accent: 'us' | 'uk', generation: number): Promise<void> {
  if (generation !== playbackGeneration) throw new PlaybackSupersededError()

  if (isBrowserH5()) {
    try {
      await playUrl(buildYoudaoUrl(text, accent), generation)
      return
    } catch (err) {
      if (isSuperseded(err) || generation !== playbackGeneration) throw new PlaybackSupersededError()
      // real Youdao failure → backend once, only if still current
    }
    if (generation !== playbackGeneration) throw new PlaybackSupersededError()
    await playUrl(buildBackendTtsUrl(text, accent), generation)
    return
  }
  await playUrl(buildBackendTtsUrl(text, accent), generation)
}

export async function speakText(
  text: string,
  maxLen = MAX_TTS_LENGTH,
  accent: 'us' | 'uk' = 'us'
): Promise<void> {
  const cleaned = sanitizeForTts(text || '', maxLen)
  if (!cleaned || !isSpeakableForTts(cleaned)) return Promise.reject(new Error('empty text'))
  if (!isTtsSupported()) return Promise.reject(new Error('TTS not supported'))

  // New generation invalidates any in-flight play (incl. old-word backend fallback)
  const generation = ++playbackGeneration
  destroyActiveAudio()
  speaking = false

  try {
    await playWithFallback(cleaned, accent, generation)
  } catch (err) {
    if (isSuperseded(err)) return
    throw err
  }
}

export async function speakPassage(text: string, accent: 'us' | 'uk' = 'us'): Promise<void> {
  const parts = splitTextForTts(text)
  const chunks = parts.length
    ? parts
    : [sanitizeForTts(text || '', MAX_TTS_LENGTH)].filter(Boolean)
  if (!chunks.length) return Promise.reject(new Error('empty text'))
  if (!isTtsSupported()) return Promise.reject(new Error('TTS not supported'))

  // One generation for the whole passage — a newer speak cancels remaining chunks
  const generation = ++playbackGeneration
  destroyActiveAudio()
  speaking = false

  for (const part of chunks) {
    if (generation !== playbackGeneration) return
    const cleaned = sanitizeForTts(part, MAX_TTS_LENGTH)
    if (!cleaned || !isSpeakableForTts(cleaned)) continue
    try {
      await playWithFallback(cleaned, accent, generation)
    } catch (err) {
      if (isSuperseded(err)) return
      throw err
    }
  }
}

export async function speakReplyText(text: string): Promise<void> {
  return speakPassage(text, 'us')
}
