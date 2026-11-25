import { getApiBaseUrl, getAuthToken } from '@/utils/api'
import { isBrowserH5 } from '@/platform/runtime'
import { splitTextForTts, isValidTtsText, sanitizeForTts, MAX_TTS_LENGTH } from '@/utils/tts-text'

let speaking = false
let activeAudio: UniApp.InnerAudioContext | null = null
let activeH5Audio: HTMLAudioElement | null = null
let ttsUnlocked = false
/** Bump on every new speak / stop — stale plays must not fallback or resume. */
let playbackGeneration = 0
const preloadStarted = new Set<string>()
let preferredGender: 'female' | 'male' = 'female'
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null

export function setTtsGender(gender: 'female' | 'male') {
  preferredGender = gender === 'male' ? 'male' : 'female'
}

export function getTtsGender(): 'female' | 'male' {
  return preferredGender
}

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

function buildBackendTtsUrl(
  word: string,
  accent: 'us' | 'uk' = 'us',
  gender: 'female' | 'male' = preferredGender
): string {
  const cleaned = sanitizeForTts(word || '')
  let url = `${getApiBaseUrl()}/tts?word=${encodeURIComponent(cleaned)}`
  if (accent === 'uk') url += '&accent=uk'
  if (gender === 'male') url += '&gender=male'
  const token = getAuthToken()
  if (token) url += `&token=${encodeURIComponent(token)}`
  return url
}

function buildTtsUrl(word: string, accent: 'us' | 'uk' = 'us'): string {
  // Female words: Youdao (best quality). Male: backend (HaiCi 男生版).
  if (isBrowserH5() && preferredGender !== 'male') return buildYoudaoUrl(word, accent)
  return buildBackendTtsUrl(word, accent, preferredGender)
}

/** Short word/phrase → dictionary clip; full sentences → browser TTS. */
function isDictClipText(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 48) return false
  if (/[.!?。！？;；]/.test(t)) return false
  return true
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
  cancelBrowserTts()
  speaking = false
}

function cancelBrowserTts() {
  try {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  } catch {
    // ignore
  }
}

const FEMALE_VOICE_HINTS = [
  'female', 'samantha', 'karen', 'moira', 'tessa', 'fiona', 'veena', 'zira', 'susan',
  'emma', 'joanna', 'salli', 'ivy', 'raveena', 'serena', 'kate', 'victoria', 'allison'
]
const MALE_VOICE_HINTS = [
  'male', 'alex', 'daniel', 'david', 'fred', 'tom', 'mark', 'guy', 'matthew',
  'justin', 'eric', 'james', 'oliver', 'thomas', 'aaron', 'nathan'
]

function getVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve([])
  const existing = speechSynthesis.getVoices()
  if (existing.length) return Promise.resolve(existing)
  if (voicesReady) return voicesReady
  voicesReady = new Promise(resolve => {
    const done = () => {
      speechSynthesis.removeEventListener('voiceschanged', done)
      resolve(speechSynthesis.getVoices())
    }
    speechSynthesis.addEventListener('voiceschanged', done)
    // Safari sometimes never fires; don't hang forever
    setTimeout(() => {
      speechSynthesis.removeEventListener('voiceschanged', done)
      resolve(speechSynthesis.getVoices())
    }, 800)
  })
  return voicesReady
}

function scoreVoice(voice: SpeechSynthesisVoice, accent: 'us' | 'uk', gender: 'female' | 'male') {
  const name = voice.name.toLowerCase()
  const lang = (voice.lang || '').toLowerCase()
  let score = 0
  if (lang.startsWith('en')) score += 5
  if (accent === 'us' && lang.startsWith('en-us')) score += 12
  if (accent === 'uk' && (lang.startsWith('en-gb') || lang.startsWith('en-uk'))) score += 12
  const want = gender === 'female' ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS
  const avoid = gender === 'female' ? MALE_VOICE_HINTS : FEMALE_VOICE_HINTS
  if (want.some(h => name.includes(h))) score += 24
  if (avoid.some(h => name.includes(h))) score -= 20
  if (voice.localService) score += 2
  return score
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  accent: 'us' | 'uk',
  gender: 'female' | 'male'
): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  const english = voices.filter(v => (v.lang || '').toLowerCase().startsWith('en'))
  const pool = english.length ? english : voices
  let best = pool[0]
  let bestScore = -Infinity
  for (const voice of pool) {
    const score = scoreVoice(voice, accent, gender)
    if (score > bestScore) {
      best = voice
      bestScore = score
    }
  }
  return best || null
}

function speakBrowserTts(text: string, accent: 'us' | 'uk', generation: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof speechSynthesis === 'undefined') {
      reject(new Error('browser tts unavailable'))
      return
    }
    if (generation !== playbackGeneration) {
      reject(new PlaybackSupersededError())
      return
    }

    destroyActiveAudio()
    cancelBrowserTts()

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = accent === 'uk' ? 'en-GB' : 'en-US'
    utter.rate = 0.95
    utter.volume = 1

    let settled = false
    const finish = (ok: boolean, err?: Error) => {
      if (settled) return
      settled = true
      if (generation !== playbackGeneration) {
        speaking = false
        reject(new PlaybackSupersededError())
        return
      }
      speaking = false
      if (ok) resolve()
      else reject(err || new Error('browser tts failed'))
    }

    utter.onend = () => finish(true)
    utter.onerror = () => finish(false, new Error('browser tts failed'))

    void getVoicesAsync().then(voices => {
      if (generation !== playbackGeneration) {
        finish(false, new PlaybackSupersededError())
        return
      }
      const voice = pickVoice(voices, accent, preferredGender)
      if (voice) {
        utter.voice = voice
        utter.lang = voice.lang || utter.lang
      }
      speaking = true
      speechSynthesis.speak(utter)
    })
  })
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
  if (!text) return

  const key = `${preferredGender}:${text.toLowerCase()}`
  if (preloadStarted.has(key)) return
  preloadStarted.add(key)
  if (isBrowserH5() && typeof Audio !== 'undefined') {
    try {
      const el = new Audio()
      el.preload = 'auto'
      el.src = buildTtsUrl(text)
    } catch {
      preloadStarted.delete(key)
    }
    return
  }
  uni.request({
    url: buildBackendTtsUrl(text, 'us', preferredGender),
    method: 'GET',
    responseType: 'arraybuffer',
    timeout: 8000,
    fail: () => preloadStarted.delete(key)
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

async function playDictClip(text: string, accent: 'us' | 'uk', generation: number): Promise<void> {
  // Female → Youdao (classic dictionary voice). Male → backend HaiCi 男生版.
  if (isBrowserH5() && preferredGender !== 'male') {
    await playUrl(buildYoudaoUrl(text, accent), generation)
    return
  }
  try {
    await playUrl(buildBackendTtsUrl(text, accent, preferredGender), generation)
    return
  } catch (err) {
    if (isSuperseded(err) || generation !== playbackGeneration) throw new PlaybackSupersededError()
  }
  // Male backend miss → still prefer Youdao over robotic browser TTS
  await playUrl(buildYoudaoUrl(text, accent), generation)
}

async function playWithFallback(text: string, accent: 'us' | 'uk', generation: number): Promise<void> {
  if (generation !== playbackGeneration) throw new PlaybackSupersededError()

  if (isBrowserH5()) {
    // Words / short phrases: dictionary audio (Youdao / gendered clip)
    if (isDictClipText(text)) {
      try {
        await playDictClip(text, accent, generation)
        return
      } catch (err) {
        if (isSuperseded(err) || generation !== playbackGeneration) throw new PlaybackSupersededError()
      }
    }
    // Sentences / examples: browser TTS with selected gender
    try {
      await speakBrowserTts(text, accent, generation)
      return
    } catch (err) {
      if (isSuperseded(err) || generation !== playbackGeneration) throw new PlaybackSupersededError()
    }
    try {
      await playUrl(buildYoudaoUrl(text, accent), generation)
      return
    } catch (err) {
      if (isSuperseded(err) || generation !== playbackGeneration) throw new PlaybackSupersededError()
    }
    await playUrl(buildBackendTtsUrl(text, accent, preferredGender), generation)
    return
  }
  await playUrl(buildBackendTtsUrl(text, accent, preferredGender), generation)
}

export async function speakText(
  text: string,
  maxLen = MAX_TTS_LENGTH,
  accent: 'us' | 'uk' = 'us'
): Promise<void> {
  const cleaned = sanitizeForTts(text || '', maxLen)
  if (!cleaned || !isSpeakableForTts(cleaned)) return Promise.reject(new Error('empty text'))
  if (!isTtsSupported() && typeof speechSynthesis === 'undefined') {
    return Promise.reject(new Error('TTS not supported'))
  }

  // New generation invalidates any in-flight play (incl. old-word backend fallback)
  const generation = ++playbackGeneration
  destroyActiveAudio()
  cancelBrowserTts()
  speaking = false

  try {
    await playWithFallback(cleaned, accent, generation)
  } catch (err) {
    if (isSuperseded(err)) return
    throw err
  }
}

/** Explicit sentence/example playback — always browser TTS on H5 (TypeWords). */
export async function speakSentence(text: string, accent: 'us' | 'uk' = 'us'): Promise<void> {
  const cleaned = sanitizeForTts(text || '', 400)
  if (!cleaned || !isSpeakableForTts(cleaned, 1)) return Promise.reject(new Error('empty text'))

  const generation = ++playbackGeneration
  destroyActiveAudio()
  cancelBrowserTts()
  speaking = false

  try {
    if (isBrowserH5()) {
      await speakBrowserTts(cleaned, accent, generation)
      return
    }
    await playUrl(buildBackendTtsUrl(cleaned, accent), generation)
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
  cancelBrowserTts()
  speaking = false

  for (const part of chunks) {
    if (generation !== playbackGeneration) return
    const cleaned = sanitizeForTts(part, Math.max(MAX_TTS_LENGTH, 220))
    if (!cleaned || !isSpeakableForTts(cleaned)) continue
    try {
      if (isBrowserH5()) await speakBrowserTts(cleaned, accent, generation)
      else await playWithFallback(cleaned, accent, generation)
    } catch (err) {
      if (isSuperseded(err)) return
      throw err
    }
  }
}

export async function speakReplyText(text: string): Promise<void> {
  return speakPassage(text, 'us')
}
