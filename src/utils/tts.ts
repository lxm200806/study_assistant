import { getApiBaseUrl } from '@/utils/api'
import { isBrowserH5 } from '@/utils/audio-recording'
import { splitTextForTts, isValidTtsText, sanitizeForTts, MAX_TTS_LENGTH } from '@/utils/tts-text'

let speaking = false
let activeAudio: UniApp.InnerAudioContext | null = null
let activeH5Audio: HTMLAudioElement | null = null
let ttsUnlocked = false
const preloadStarted = new Set<string>()

const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

function buildTtsUrl(word: string): string {
  const cleaned = sanitizeForTts(word || '')
  return `${getApiBaseUrl()}/tts?word=${encodeURIComponent(cleaned)}`
}

export function isSpeakableForTts(text: string, minLetters = 2): boolean {
  return isValidTtsText(text) && (text.match(/[a-zA-Z]/g) || []).length >= minLetters
}

export function isTtsSupported(): boolean {
  return typeof uni !== 'undefined' && typeof uni.createInnerAudioContext === 'function'
}

/** H5: play silent clip during mic press so later auto-TTS is allowed */
export function unlockTtsPlayback(): Promise<void> {
  if (!isBrowserH5() || ttsUnlocked) return Promise.resolve()

  const el = new Audio(SILENT_WAV)
  el.volume = 0.01
  return el.play()
    .then(() => { ttsUnlocked = true })
    .catch(async () => {
      try {
        const Ctx = window.AudioContext
          || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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
      el.pause()
      el.src = ''
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
  destroyActiveAudio()
  speaking = false
}

/** H5-specific playback: uses native Audio() and properly catches AbortError. */
function playUrlH5(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    destroyActiveAudio()

    const el = new Audio(url)
    el.volume = 1
    activeH5Audio = el

    let settled = false
    const finish = (ok: boolean, err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      speaking = false
      if (activeH5Audio === el) activeH5Audio = null
      if (ok) resolve()
      else reject(err || new Error('audio playback failed'))
    }

    el.addEventListener('ended', () => finish(true))
    el.addEventListener('error', () => finish(false, new Error('audio playback failed')))

    const timer = setTimeout(() => finish(false, new Error('audio timeout')), 20000)

    speaking = true
    const playPromise = el.play()
    if (playPromise !== undefined) {
      playPromise.catch((err: DOMException | Error) => {
        clearTimeout(timer)
        // AbortError means a newer play() superseded this one — not a real error.
        if ((err as DOMException).name === 'AbortError') {
          finish(true)
        } else {
          finish(false, err instanceof Error ? err : new Error('audio playback failed'))
        }
      })
    }
  })
}

function playUrl(url: string): Promise<void> {
  if (isBrowserH5()) return playUrlH5(url)

  return new Promise((resolve, reject) => {
    destroyActiveAudio()

    const audio = uni.createInnerAudioContext()
    activeAudio = audio

    let settled = false
    const finish = (ok: boolean, err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
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
    audio.onError(() => finish(false, new Error('audio playback failed')))

    const timer = setTimeout(() => finish(false, new Error('audio timeout')), 20000)

    speaking = true
    audio.src = url
    audio.play()
  })
}

export function preloadWordAudio(word: string): void {
  const text = sanitizeForTts(word || '')
  if (!text || preloadStarted.has(text.toLowerCase())) return

  preloadStarted.add(text.toLowerCase())
  uni.request({
    url: buildTtsUrl(text),
    method: 'GET',
    responseType: 'arraybuffer',
    timeout: 30000,
    fail: () => preloadStarted.delete(text.toLowerCase())
  })
}

export function speakWord(word: string, _lang = 'en-US'): Promise<void> {
  const text = sanitizeForTts(word || '', MAX_TTS_LENGTH)
  if (!text || !isSpeakableForTts(text, 1)) return Promise.reject(new Error('empty word'))
  if (!isTtsSupported()) return Promise.reject(new Error('TTS not supported'))
  stopSpeak()
  return playUrl(buildTtsUrl(text))
}

export function getSpeakingState(): boolean {
  return speaking
}

export function getWordAudioUrl(word: string): string {
  return buildTtsUrl(word)
}

export async function speakText(text: string, maxLen = MAX_TTS_LENGTH): Promise<void> {
  const cleaned = sanitizeForTts(text || '', maxLen)
  if (!cleaned || !isSpeakableForTts(cleaned)) return Promise.reject(new Error('empty text'))
  if (!isTtsSupported()) return Promise.reject(new Error('TTS not supported'))
  stopSpeak()
  return playUrl(buildTtsUrl(cleaned))
}

/** Speak full AI reply — same path as manual 🔊 button */
export async function speakReplyText(text: string): Promise<void> {
  const parts = splitTextForTts(text)
  if (!parts.length) {
    const single = sanitizeForTts(text, MAX_TTS_LENGTH)
    if (single && isSpeakableForTts(single)) await speakText(single)
    return
  }
  for (const part of parts) {
    await speakText(part)
  }
}
