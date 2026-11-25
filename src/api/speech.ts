import { request } from './client'

export const chatAPI = {
  send: async (
    content: string,
    bookCode?: string,
    mode?: 'free' | 'challenge' | 'roleplay',
    scenario?: string
  ) => {
    return request<{
      userMessage: string
      aiResponse: string
      matchedWords: Array<{ wordId: string; word: string; type: string }>
      remainingFree?: number
    }>('/chat/send', 'POST', { content, bookCode, mode, scenario })
  },
  history: async (page: number = 1, limit: number = 20) => {
    return request<Array<{ id: string; role: string; content: string; createdAt: string }>>(
      `/chat/history?page=${page}&limit=${limit}`,
      'GET'
    )
  },
  quota: async () => {
    return request<{ remaining: number; isPremium: boolean }>('/chat/quota', 'GET')
  }
}

export const speechAPI = {
  asrConfig: async () => {
    return request<{ provider: 'xfyun' | 'whisper' }>('/speech/asr/config', 'GET')
  },
  asrStartSession: async (encoding: 'lame' | 'raw' = 'lame') => {
    return request<{ sessionId: string; provider: 'xfyun' | 'whisper' }>(
      '/speech/asr/session/start',
      'POST',
      { encoding }
    )
  },
  asrPushChunk: async (sessionId: string, audioBase64: string, isLast = false) => {
    return request<{ partial: string; isFinal: boolean }>('/speech/asr/session/chunk', 'POST', {
      sessionId,
      audioBase64,
      isLast
    })
  },
  asrEndSession: async (sessionId: string) => {
    return request<{ text: string }>('/speech/asr/session/end', 'POST', { sessionId })
  },
  transcribe: async (audioBase64: string, mimeType = 'audio/mp3') => {
    return request<{ text: string }>('/speech/transcribe', 'POST', { audioBase64, mimeType })
  },
  assess: async (referenceText: string, audioBase64: string, mimeType = 'audio/mp3') => {
    return request<{ transcript: string; score: number; passed: boolean; feedback: string }>(
      '/speech/assess',
      'POST',
      { referenceText, audioBase64, mimeType }
    )
  }
}
