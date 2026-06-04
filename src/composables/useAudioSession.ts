import { getApiBaseUrl, getAuthToken, request } from '@/utils/api'

export function useAudioSession() {
  let recorder: UniApp.RecorderManager | null = null
  let localAudio: UniApp.InnerAudioContext | null = null
  let recordResolve: ((path: string) => void) | null = null

  const ensureRecorder = () => {
    if (recorder) return recorder
    recorder = uni.getRecorderManager()
    recorder.onStop((res) => {
      if (recordResolve && res.tempFilePath) {
        recordResolve(res.tempFilePath)
        recordResolve = null
      }
    })
    recorder.onError(() => {
      recordResolve = null
    })
    return recorder
  }

  const startRecord = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        ensureRecorder().start({ format: 'mp3', sampleRate: 16000 })
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  }

  const stopRecord = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      recordResolve = resolve
      try {
        ensureRecorder().stop()
        setTimeout(() => {
          if (recordResolve) {
            recordResolve = null
            reject(new Error('录音失败'))
          }
        }, 8000)
      } catch (e) {
        recordResolve = null
        reject(e)
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
    return new Promise((resolve, reject) => {
      stopPlay()
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

  const readFileAsBase64 = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (typeof uni.getFileSystemManager === 'function') {
        uni.getFileSystemManager().readFile({
          filePath,
          encoding: 'base64',
          success: (res) => resolve(res.data as string),
          fail: (err) => reject(new Error(err.errMsg || 'read file failed'))
        })
        return
      }
      reject(new Error('file system not supported'))
    })
  }

  const uploadTranscribe = async (filePath: string): Promise<string> => {
    const audioBase64 = await readFileAsBase64(filePath)
    const result = await request<{ text: string }>('/speech/transcribe', 'POST', {
      audioBase64,
      mimeType: 'audio/mp3'
    })
    return result.data?.text || ''
  }

  const assessPronunciation = async (filePath: string, referenceText: string) => {
    const audioBase64 = await readFileAsBase64(filePath)
    const result = await request<{
      transcript: string
      score: number
      passed: boolean
      feedback: string
    }>('/speech/assess', 'POST', {
      audioBase64,
      referenceText,
      mimeType: 'audio/mp3'
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
