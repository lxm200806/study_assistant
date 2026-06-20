export type RecordBackend = 'uni' | 'h5'

/** H5 下不要调用 uni.getRecorderManager()，否则会刷控制台错误 */
export function isBrowserH5(): boolean {
  if (import.meta.env?.UNI_PLATFORM === 'h5') return true
  if (typeof window === 'undefined') return false
  try {
    const info = uni.getSystemInfoSync?.()
    return info?.uniPlatform === 'web' || info?.platform === 'web'
  } catch {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  }
}

export function detectRecordBackend(): RecordBackend {
  if (isBrowserH5()) {
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    ) {
      return 'h5'
    }
    throw new Error('当前环境不支持录音')
  }

  const mgr = uni.getRecorderManager?.()
  if (mgr && typeof mgr.start === 'function') return 'uni'
  throw new Error('当前环境不支持录音')
}

export function pickH5MimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return 'audio/webm'
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
      resolve(base64 || '')
    }
    reader.onerror = () => reject(new Error('读取录音失败'))
    reader.readAsDataURL(blob)
  })
}

export async function readRecordingAsBase64(
  filePath: string,
  fallbackMimeType = 'audio/mp3'
): Promise<{ base64: string; mimeType: string }> {
  if (filePath.startsWith('blob:')) {
    const res = await fetch(filePath)
    const blob = await res.blob()
    const base64 = await blobToBase64(blob)
    return { base64, mimeType: blob.type || fallbackMimeType }
  }

  if (typeof uni.getFileSystemManager !== 'function') {
    throw new Error('无法读取录音文件')
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    uni.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data as string),
      fail: (err) => reject(new Error(err.errMsg || 'read file failed'))
    })
  })

  return { base64, mimeType: fallbackMimeType }
}

export type XfyunAudioEncoding = 'lame' | 'raw'

async function loadRecordingBlob(filePath: string, fallbackMimeType: string): Promise<Blob> {
  if (filePath.startsWith('blob:')) {
    const res = await fetch(filePath)
    return res.blob()
  }
  throw new Error('无法读取录音文件')
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export async function convertRecordingToPcm16Base64(
  filePath: string,
  fallbackMimeType: string
): Promise<string> {
  const blob = await loadRecordingBlob(filePath, fallbackMimeType)
  const arrayBuffer = await blob.arrayBuffer()
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) {
    throw new Error('当前浏览器无法转换录音格式')
  }

  const decodeCtx = new AudioCtx()
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    await decodeCtx.close()
  }

  const targetLength = Math.max(1, Math.round(audioBuffer.duration * 16000))
  const offline = new OfflineAudioContext(1, targetLength, 16000)
  const source = offline.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offline.destination)
  source.start(0)
  const rendered = await offline.startRendering()
  const samples = rendered.getChannelData(0)
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    pcm[i] = sample < 0 ? sample * 32768 : sample * 32767
  }
  return uint8ArrayToBase64(new Uint8Array(pcm.buffer))
}

export async function prepareRecordingForAsr(
  filePath: string,
  fallbackMimeType: string
): Promise<{ base64: string; mimeType: string; xfyunEncoding: XfyunAudioEncoding }> {
  const { base64, mimeType } = await readRecordingAsBase64(filePath, fallbackMimeType)
  const lower = mimeType.toLowerCase()
  if (lower.includes('mp3') || lower.includes('mpeg')) {
    return { base64, mimeType, xfyunEncoding: 'lame' }
  }

  if (typeof window !== 'undefined' && (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) {
    try {
      const pcmBase64 = await convertRecordingToPcm16Base64(filePath, fallbackMimeType)
      return {
        base64: pcmBase64,
        mimeType: 'audio/L16;rate=16000',
        xfyunEncoding: 'raw'
      }
    } catch {
      // Some H5 recorders emit WebM/Opus that decodeAudioData cannot decode.
      // Fall back to the original container so the backend can route it to Whisper.
      return { base64, mimeType, xfyunEncoding: 'lame' }
    }
  }

  return { base64, mimeType, xfyunEncoding: 'lame' }
}

export function mapMicError(error: unknown): Error {
  const name = (error as DOMException)?.name || ''
  const message = (error as Error)?.message || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return new Error('请允许浏览器麦克风权限')
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new Error('未检测到麦克风设备')
  }
  if (message.includes('不支持')) return error as Error
  return new Error(message || '无法开始录音')
}
