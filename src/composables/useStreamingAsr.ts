import { ref } from 'vue'
import { useAudioSession } from '@/composables/useAudioSession'
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
    const res = await speechAPI.asrStartSession()
    sessionId = res.data?.sessionId || ''
    if (res.data?.provider === 'xfyun' || res.data?.provider === 'whisper') {
      asrProvider.value = res.data.provider
    }
    if (!sessionId) throw new Error('ASR session failed')
  }

  const uploadRecording = async (filePath: string): Promise<string> => {
    if (!sessionId) await startSession()

    const audio = useAudioSession()
    const base64 = await readFileBase64(filePath)
    const chunks = splitBase64Chunks(base64)

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1
      const res = await speechAPI.asrPushChunk(sessionId, chunks[i], isLast)
      if (res.data?.partial) {
        partialText.value = res.data.partial
      }
      if (res.data?.isFinal && res.data.partial) {
        return res.data.partial
      }
    }

    const endRes = await speechAPI.asrEndSession(sessionId)
    const text = endRes.data?.text || partialText.value
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

function readFileBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof uni.getFileSystemManager !== 'function') {
      reject(new Error('file system not supported'))
      return
    }
    uni.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data as string),
      fail: (err) => reject(new Error(err.errMsg || 'read failed'))
    })
  })
}
