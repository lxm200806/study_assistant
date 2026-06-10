// Audio recording hook for React Native
import { useState, useCallback, useRef } from 'react'
import * as FileSystem from 'expo-file-system'
import { Audio } from 'expo-av'

export type RecordingStatus = 'idle' | 'requestingPermission' | 'recording' | 'stopped' | 'error'

export interface UseAudioRecordingResult {
  status: RecordingStatus
  lastRecordingUri: string | null
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<string | null>
  isRecording: boolean
}

export function useAudioRecording(): UseAudioRecordingResult {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const recordingRef = useRef<Audio.Recording | null>(null)

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      setStatus('requestingPermission')

      // Request permissions
      const { granted } = await Audio.requestPermissionsAsync()
      if (!granted) {
        setStatus('error')
        setError('请允许麦克风权限')
        return
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      })

      // Create and start recording
      const recording = new Audio.Recording()
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await recording.startAsync()
      recordingRef.current = recording
      setStatus('recording')
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }, [])

  const stopRecording = useCallback(async () => {
    try {
      const recording = recordingRef.current
      if (!recording) return null

      recordingRef.current = null
      await recording.stopAndUnloadAsync()
      
      const uri = recording.getURI()
      setLastRecordingUri(uri)
      setStatus('stopped')

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      })

      return uri
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
      return null
    }
  }, [])

  const isRecording = status === 'recording'

  return {
    status,
    lastRecordingUri,
    error,
    startRecording,
    stopRecording,
    isRecording
  }
}

// Convert recording to base64 for API upload
export async function recordingToBase64(uri: string): Promise<string> {
  try {
    const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
    return data:audio/wav;base64,
  } catch (err) {
    console.error('Failed to convert recording to base64:', err)
    return ''
  }
}

