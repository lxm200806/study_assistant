import { useCallback, useRef, useState } from 'react'
import { Audio } from 'expo-av'
import { startAsrSession, pushAsrChunk, endAsrSession, getAsrConfig } from '@/api/client'

export type VoiceStatus = 'idle' | 'requestingPermission' | 'recording' | 'transcribing' | 'stopped' | 'error'

// Convert Audio recording URI to base64 (for Wav)
async function recordingToBase64(uri: string): Promise<string> {
  const fs = require('react-native-fs')
  const base64Data = await fs.readFile(uri, 'base64')
  return `data:audio/wav;base64,${base64Data}`
}

export function usePushToTalk() {
  const recordingRef = useRef<Audio.Recording | null>(null)
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [lastUri, setLastUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [partialTranscript, setPartialTranscript] = useState('')

  const start = useCallback(async () => {
    setError(null)
    setLastUri(null)
    setPartialTranscript('')
    setStatus('requestingPermission')

    const permission = await Audio.requestPermissionsAsync()
    if (!permission.granted) {
      setStatus('error')
      setError('请允许麦克风权限')
      return
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    })

    const recording = new Audio.Recording()
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
    await recording.startAsync()
    recordingRef.current = recording
    setStatus('recording')
  }, [])

  const stop = useCallback(async () => {
    const recording = recordingRef.current
    if (!recording) return null
    recordingRef.current = null
    await recording.stopAndUnloadAsync()
    const uri = recording.getURI()
    setLastUri(uri)
    setStatus('stopped')
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })
    return uri
  }, [])

  // Integrate with backend ASR (optional enhancement for future)
  const startAsrSession_ = useCallback(async () => {
    try {
      const config = await getAsrConfig()
      if (config.data?.provider === 'xfyun') {
        const session = await startAsrSession('lame')
        return session.data || null
      }
      return null
    } catch {
      return null // Whisper or fallback — no special setup needed
    }
  }, [])

  const stopAndTranscribe = useCallback(async (uri: string): Promise<string | null> => {
    if (!uri) return null
    try {
      setStatus('transcribing')
      const fs = require('react-native-fs')
      const base64Data = await fs.readFile(uri, 'base64')
      const audioBase64 = `data:audio/wav;base64,${base64Data}`

      // Use server-side transcription (Whisper or xfyun)
      // In production: send chunked to ASR session
      // For now: placeholder — will integrate with backend later
      setStatus('stopped')
      return null // Placeholder — returns no text yet
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
      return null
    }
  }, [])

  return {
    status,
    lastUri,
    error,
    partialTranscript,
    start,
    stop,
    isRecording: status === 'recording',
    startAsrSession: startAsrSession_,
    stopAndTranscribe,
  }
}
