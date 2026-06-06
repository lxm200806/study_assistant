import { getApiBaseUrl, getAuthToken, request } from '@/utils/api'
import {
  detectRecordBackend,
  isBrowserH5,
  mapMicError,
  pickH5MimeType,
  prepareRecordingForAsr,
  type RecordBackend
} from '@/utils/audio-recording'

export function useAudioSession() {
  let recorder: UniApp.RecorderManager | null = null
  let localAudio: UniApp.InnerAudioContext | null = null
  let recordResolve: ((path: string) => void) | null = null
  let recordReject: ((error: Error) => void) | null = null
  let recordBackend: RecordBackend | null = null
  let lastMimeType = 'audio/mp3'

  let h5MediaRecorder: MediaRecorder | null = null
  let h5Stream: MediaStream | null = null
  let h5Chunks: Blob[] = []
  let h5MimeType = 'audio/webm'

  const ensureUniRecorder = () => {
    if (isBrowserH5()) {
      throw new Error('当前环境不支持录音')
    }
    if (recorder) return recorder
    const mgr = uni.getRecorderManager?.()
    if (!mgr || typeof mgr.start !== 'function') {
      throw new Error('当前环境不支持录音')
    }
    recorder = mgr
    recorder.onStop((res) => {
      if (recordResolve && res.tempFilePath) {
        lastMimeType = 'audio/mp3'
        recordResolve(res.tempFilePath)
        recordResolve = null
        recordReject = null
      }
    })
    recorder.onError(() => {
      recordReject?.(new Error('录音失败'))
      recordResolve = null
      recordReject = null
    })
    return recorder
  }

  const stopH5Stream = () => {
    h5Stream?.getTracks().forEach((track) => track.stop())
    h5Stream = null
  }

  const startH5Record = async (): Promise<void> => {
    h5MimeType = pickH5MimeType()
    h5Chunks = []
    try {
      h5Stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (error) {
      throw mapMicError(error)
    }

    try {
      h5MediaRecorder = h5MimeType
        ? new MediaRecorder(h5Stream, { mimeType: h5MimeType })
        : new MediaRecorder(h5Stream)
      if (!h5MimeType && h5MediaRecorder.mimeType) {
        h5MimeType = h5MediaRecorder.mimeType
      }
    } catch {
      h5MediaRecorder = new MediaRecorder(h5Stream)
      h5MimeType = h5MediaRecorder.mimeType || 'audio/webm'
    }

    h5MediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) h5Chunks.push(event.data)
    }
    h5MediaRecorder.onerror = () => {
      recordReject?.(new Error('录音失败'))
      recordResolve = null
      recordReject = null
      stopH5Stream()
    }

    h5MediaRecorder.start(250)
    lastMimeType = h5MimeType
  }

  const stopH5Record = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!h5MediaRecorder || h5MediaRecorder.state === 'inactive') {
        reject(new Error('录音失败'))
        return
      }

      h5MediaRecorder.onstop = () => {
        stopH5Stream()
        const blob = new Blob(h5Chunks, { type: h5MimeType || 'audio/webm' })
        h5MediaRecorder = null
        h5Chunks = []
        if (blob.size === 0) {
          reject(new Error('录音失败'))
          return
        }
        lastMimeType = blob.type || h5MimeType
        resolve(URL.createObjectURL(blob))
      }

      try {
        h5MediaRecorder.stop()
      } catch (error) {
        stopH5Stream()
        reject(mapMicError(error))
      }
    })
  }

  const startRecord = async (): Promise<void> => {
    recordBackend = detectRecordBackend()
    if (recordBackend === 'h5') {
      await startH5Record()
      return
    }
    ensureUniRecorder().start({ format: 'mp3', sampleRate: 16000 })
    lastMimeType = 'audio/mp3'
  }

  const stopRecord = (): Promise<string> => {
    if (recordBackend === 'h5') {
      return stopH5Record()
    }

    return new Promise((resolve, reject) => {
      recordResolve = resolve
      recordReject = reject
      try {
        ensureUniRecorder().stop()
        setTimeout(() => {
          if (recordResolve) {
            recordResolve = null
            recordReject = null
            reject(new Error('录音失败'))
          }
        }, 8000)
      } catch (error) {
        recordResolve = null
        recordReject = null
        reject(mapMicError(error))
      }
    })
  }

  const stopPlay = () => {
    if (!localAudio) return
    try {
      localAudio.stop()
      localAudio.destroy()
    } catch {
      // ignore
    }
    localAudio = null
  }

  const playLocal = (path: string): Promise<void> => {
    stopPlay()

    // H5: blob URLs should use native Audio() so AbortError is handled correctly.
    if (isBrowserH5() && path.startsWith('blob:')) {
      return new Promise((resolve, reject) => {
        const el = new Audio(path)
        el.volume = 1
        el.addEventListener('ended', () => resolve())
        el.addEventListener('error', () => reject(new Error('播放失败')))
        const playPromise = el.play()
        if (playPromise !== undefined) {
          playPromise.catch((err: DOMException | Error) => {
            if ((err as DOMException).name === 'AbortError') resolve()
            else reject(new Error('播放失败'))
          })
        }
      })
    }

    return new Promise((resolve, reject) => {
      const audio = uni.createInnerAudioContext()
      localAudio = audio
      audio.src = path
      audio.onEnded(() => {
        stopPlay()
        resolve()
      })
      audio.onError(() => {
        stopPlay()
        reject(new Error('播放失败'))
      })
      audio.play()
    })
  }

  const uploadTranscribe = async (filePath: string): Promise<string> => {
    const fallbackMime = recordBackend === 'h5' ? pickH5MimeType() : lastMimeType
    const prepared = await prepareRecordingForAsr(filePath, fallbackMime)
    const result = await request<{ text: string }>('/speech/transcribe', 'POST', {
      audioBase64: prepared.base64,
      mimeType: prepared.mimeType
    })
    return result.data?.text || ''
  }

  const assessPronunciation = async (filePath: string, referenceText: string) => {
    const fallbackMime = recordBackend === 'h5' ? pickH5MimeType() : lastMimeType
    const prepared = await prepareRecordingForAsr(filePath, fallbackMime)
    const result = await request<{
      transcript: string
      score: number
      passed: boolean
      feedback: string
    }>('/speech/assess', 'POST', {
      audioBase64: prepared.base64,
      referenceText,
      mimeType: prepared.mimeType
    })
    return result.data
  }

  return {
    startRecord,
    stopRecord,
    playLocal,
    stopPlay,
    uploadTranscribe,
    assessPronunciation,
    getAuthToken
  }
}

export { getApiBaseUrl, getAuthToken }
export { readRecordingAsBase64 } from '@/utils/audio-recording'
