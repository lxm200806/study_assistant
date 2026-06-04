import { getApiBaseUrl } from '@/utils/api'

let speaking = false
let activeAudio: UniApp.InnerAudioContext | null = null
const preloadStarted = new Set<string>()

function buildTtsUrl(word: string): string {
  return `${getApiBaseUrl()}/tts?word=${encodeURIComponent(word.trim())}`
}

export function isTtsSupported(): boolean {
  return typeof uni !== 'undefined' && typeof uni.createInnerAudioContext === 'function'
}

function destroyActiveAudio(): void {
  if (!activeAudio) return
  try {
    activeAudio.stop()
    activeAudio.destroy()
  } catch {
    // ignore cleanup errors
  }
  activeAudio = null
}

export function stopSpeak(): void {
  destroyActiveAudio()
  speaking = false
}

function playUrl(url: string): Promise<void> {
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

    const timer = setTimeout(() => finish(false, new Error('audio timeout')), 15000)

    speaking = true
    audio.src = url
    audio.play()
  })
}

/** 预加载单词发音（触发服务端缓存 + 客户端连接预热） */
export function preloadWordAudio(word: string): void {
  const text = word?.trim()
  if (!text || preloadStarted.has(text.toLowerCase())) return

  preloadStarted.add(text.toLowerCase())
  const url = buildTtsUrl(text)

  uni.request({
    url,
    method: 'GET',
    responseType: 'arraybuffer',
    timeout: 30000,
    fail: () => {
      preloadStarted.delete(text.toLowerCase())
    }
  })
}

export function speakWord(word: string, _lang = 'en-US'): Promise<void> {
  const text = word?.trim()
  if (!text) return Promise.reject(new Error('empty word'))

  if (!isTtsSupported()) {
    return Promise.reject(new Error('TTS not supported'))
  }

  stopSpeak()
  return playUrl(buildTtsUrl(text))
}

export function getSpeakingState(): boolean {
  return speaking
}

export function getWordAudioUrl(word: string): string {
  return buildTtsUrl(word)
}
