import { ref } from 'vue'
import {
  detectRecordBackend,
  pickH5MimeType,
  prepareRecordingForAsr
} from '@/utils/audio-recording'
import { speechAPI } from '@/utils/api'

const CHUNK_SIZE = 8000

function splitBase64Chunks(base64: string): string[] {
  const chunks: string[] = []
  for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
    chunks.push(base64.slice(i, i + CHUNK_SIZE))
  }
  return chunks
}

export function useStreamingAsr() {
  const partialText = ref('')
  const asrProvider = ref<'xfyun' | 'whisper'>('whisper')
  let sessionId = ''

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
    const encoding = detectRecordBackend() === 'h5' ? 'raw' : 'lame'
    const res = await speechAPI.asrStartSession(encoding)
    sessionId = res.data?.sessionId || ''
    if (res.data?.provider === 'xfyun' || res.data?.provider === 'whisper') {
      asrProvider.value = res.data.provider
    }
    if (!sessionId) throw new Error('ASR session failed')
  }

  const uploadRecording = async (filePath: string): Promise<string> => {
    if (!sessionId) await startSession()

    const fallbackMime = detectRecordBackend() === 'h5' ? pickH5MimeType() : 'audio/mp3'
    const prepared = await prepareRecordingForAsr(filePath, fallbackMime)
    const chunks = splitBase64Chunks(prepared.base64)

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1
      const res = await speechAPI.asrPushChunk(sessionId, chunks[i], isLast)
      if (res.data?.partial) {
        partialText.value = res.data.partial
      }
    }

    const endRes = await speechAPI.asrEndSession(sessionId)
    const text = (endRes.data?.text || partialText.value).trim()
    partialText.value = text
    sessionId = ''
    return text
  }

  return {
    partialText,
    asrProvider,
    loadConfig,
    startSession,
    uploadRecording
  }
}

