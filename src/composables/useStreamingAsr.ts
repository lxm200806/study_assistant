import { ref } from 'vue'
import { detectRecordBackend, mapMicError, type RecordBackend } from '@/utils/audio-recording'
import { speechAPI } from '@/utils/api'

type BrowserSpeechRecognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: any) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function pcm16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function resampleTo16k(input: Float32Array, inputRate: number): Int16Array {
  const outputRate = 16000
  if (inputRate === outputRate) {
    const pcm = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      const sample = Math.max(-1, Math.min(1, input[i]))
      pcm[i] = sample < 0 ? sample * 32768 : sample * 32767
    }
    return pcm
  }

  const ratio = inputRate / outputRate
  const outputLength = Math.max(1, Math.floor(input.length / ratio))
  const pcm = new Int16Array(outputLength)
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * ratio
    const before = Math.floor(sourceIndex)
    const after = Math.min(before + 1, input.length - 1)
    const weight = sourceIndex - before
    const value = input[before] * (1 - weight) + input[after] * weight
    const sample = Math.max(-1, Math.min(1, value))
    pcm[i] = sample < 0 ? sample * 32768 : sample * 32767
  }
  return pcm
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function useStreamingAsr() {
  const partialText = ref('')
  const asrProvider = ref<'xfyun' | 'whisper'>('whisper')

  let currentBackend: RecordBackend | null = null
  let sessionId = ''
  let mediaStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let processorNode: ScriptProcessorNode | null = null
  let uploadChain: Promise<void> = Promise.resolve()
  let recording = false
  let speechRecognition: BrowserSpeechRecognition | null = null
  let browserSpeechFinal = ''
  let browserSpeechPartial = ''
  let recordingStartedAt = 0
  let pushedChunkCount = 0

  const debugLog = (event: string, payload: Record<string, unknown> = {}) => {
    try {
      console.debug('[VoiceASR]', {
        event,
        elapsedMs: recordingStartedAt ? Math.round(nowMs() - recordingStartedAt) : 0,
        ...payload
      })
    } catch {
      // ignore
    }
  }

  const loadConfig = async () => {
    try {
      const res = await speechAPI.asrConfig()
      if (res.data?.provider === 'xfyun' || res.data?.provider === 'whisper') {
        asrProvider.value = res.data.provider
      }
    } catch {
      // ignore
    }
  }

  const startSession = async () => {
    partialText.value = ''
    const res = await speechAPI.asrStartSession('raw')
    sessionId = res.data?.sessionId || ''
    if (res.data?.provider === 'xfyun' || res.data?.provider === 'whisper') {
      asrProvider.value = res.data.provider
    }
    debugLog('backend-session-started', {
      provider: asrProvider.value,
      hasSessionId: !!sessionId
    })
    if (!sessionId) throw new Error('ASR session failed')
  }

  const canUseBrowserSpeechFallback = () => {
    if (typeof window === 'undefined') return false
    const speechWindow = window as Window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition
    }
    return !!(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition)
  }

  const pushPcm = (pcm: Int16Array, isLast = false) => {
    if (!sessionId || pcm.length === 0) return
    const chunkNo = ++pushedChunkCount
    const audioBase64 = pcm16ToBase64(pcm)
    uploadChain = uploadChain
      .then(async () => {
        const res = await speechAPI.asrPushChunk(sessionId, audioBase64, isLast)
        if (res.data?.partial) {
          partialText.value = res.data.partial
          debugLog('backend-partial', {
            chunkNo,
            isLast,
            text: res.data.partial
          })
        } else if (chunkNo % 10 === 0 || isLast) {
          debugLog('backend-no-partial-yet', {
            chunkNo,
            isLast
          })
        }
      })
      .catch((error) => {
        debugLog('backend-chunk-error', {
          chunkNo,
          isLast,
          message: (error as Error).message
        })
        // Keep later chunks flowing even if one partial request fails.
      })
  }

  const browserSpeechText = () => `${browserSpeechFinal} ${browserSpeechPartial}`.trim()

  const startBrowserSpeechFallback = () => {
    browserSpeechFinal = ''
    browserSpeechPartial = ''
    if (typeof window === 'undefined') return

    const speechWindow = window as Window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition
    }
    const RecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!RecognitionCtor) {
      debugLog('browser-speech-unavailable')
      return
    }

    speechRecognition = new RecognitionCtor()
    speechRecognition.lang = 'en-US'
    speechRecognition.interimResults = true
    speechRecognition.continuous = true
    debugLog('browser-speech-starting', {
      lang: speechRecognition.lang,
      interimResults: speechRecognition.interimResults,
      continuous: speechRecognition.continuous
    })
    speechRecognition.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result?.[0]?.transcript || ''
        if (result?.isFinal) finalText += `${transcript} `
        else interimText += `${transcript} `
      }

      browserSpeechFinal = finalText.trim()
      browserSpeechPartial = interimText.trim()
      const text = browserSpeechText()
      if (text) {
        partialText.value = text
        debugLog('browser-speech-result', {
          finalText: browserSpeechFinal,
          interimText: browserSpeechPartial,
          text
        })
      }
    }
    speechRecognition.onerror = () => {
      debugLog('browser-speech-error')
      // Backend ASR remains the source of truth; this is only a live display fallback.
    }
    speechRecognition.onend = () => {
      debugLog('browser-speech-ended', { recording })
      if (!recording || !speechRecognition) return
      window.setTimeout(() => {
        if (!recording || !speechRecognition) return
        try {
          speechRecognition.start()
          debugLog('browser-speech-restarted')
        } catch {
          // ignore
        }
      }, 120)
    }

    try {
      speechRecognition.start()
      debugLog('browser-speech-started')
    } catch {
      debugLog('browser-speech-start-failed')
      speechRecognition = null
    }
  }

  const stopBrowserSpeechFallback = () => {
    if (!speechRecognition) return
    try {
      speechRecognition.stop()
      debugLog('browser-speech-stop-requested', {
        fallbackText: browserSpeechText()
      })
    } catch {
      // ignore
    }
  }

  const abortBrowserSpeechFallback = () => {
    if (!speechRecognition) return
    try {
      speechRecognition.abort()
    } catch {
      // ignore
    }
    speechRecognition = null
    browserSpeechFinal = ''
    browserSpeechPartial = ''
  }

  const stopH5Audio = async () => {
    processorNode?.disconnect()
    sourceNode?.disconnect()
    processorNode = null
    sourceNode = null
    mediaStream?.getTracks().forEach(track => track.stop())
    mediaStream = null
    if (audioContext) {
      await audioContext.close().catch(() => undefined)
      audioContext = null
    }
  }

  const startH5LiveRecording = async () => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      debugLog('mic-stream-opened', {
        audioTracks: mediaStream.getAudioTracks().length
      })
    } catch (error) {
      throw mapMicError(error)
    }

    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) {
      throw new Error('当前浏览器不支持实时语音识别')
    }

    audioContext = new AudioCtx()
    debugLog('audio-context-created', {
      sampleRate: audioContext.sampleRate
    })
    sourceNode = audioContext.createMediaStreamSource(mediaStream)
    processorNode = audioContext.createScriptProcessor(4096, 1, 1)
    recording = true
    startBrowserSpeechFallback()

    processorNode.onaudioprocess = (event) => {
      if (!recording || !audioContext) return
      const input = event.inputBuffer.getChannelData(0)
      const pcm = resampleTo16k(input, audioContext.sampleRate)
      pushPcm(pcm)
    }

    sourceNode.connect(processorNode)
    processorNode.connect(audioContext.destination)
  }

  const startLiveRecording = async () => {
    recordingStartedAt = nowMs()
    pushedChunkCount = 0
    currentBackend = detectRecordBackend()
    debugLog('start-live-recording', { backend: currentBackend })
    try {
      await startSession()
    } catch (error) {
      if (currentBackend === 'h5' && canUseBrowserSpeechFallback()) {
        sessionId = ''
        debugLog('backend-session-failed-using-browser-fallback', {
          message: (error as Error).message
        })
      } else {
        throw error
      }
    }

    if (currentBackend === 'h5') {
      await startH5LiveRecording()
    }
  }

  const stopLiveRecording = async (): Promise<string> => {
    debugLog('stop-live-recording-requested', {
      pushedChunkCount,
      currentPartialText: partialText.value,
      browserSpeechText: browserSpeechText()
    })
    recording = false
    stopBrowserSpeechFallback()
    const fallbackText = () => (partialText.value || browserSpeechText()).trim()
    if (currentBackend === 'h5') {
      await stopH5Audio()
    }

    await uploadChain
    if (!sessionId) {
      const text = fallbackText()
      debugLog('stop-live-recording-final-browser-fallback', { text })
      return text
    }

    try {
      const endRes = await speechAPI.asrEndSession(sessionId)
      const text = (endRes.data?.text || fallbackText()).trim()
      partialText.value = text
      debugLog('stop-live-recording-final-backend', { text })
      return text
    } catch (error) {
      const text = fallbackText()
      if (text) {
        debugLog('stop-live-recording-final-fallback-after-error', {
          text,
          message: (error as Error).message
        })
        return text
      }
      throw error
    } finally {
      sessionId = ''
      speechRecognition = null
    }
  }

  const stopLiveRecognition = () => {
    recording = false
    void stopH5Audio()
    abortBrowserSpeechFallback()
    sessionId = ''
  }

  return {
    partialText,
    asrProvider,
    loadConfig,
    startLiveRecording,
    stopLiveRecording,
    stopLiveRecognition
  }
}
