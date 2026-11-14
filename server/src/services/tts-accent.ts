export type TtsAccent = 'us' | 'uk'

export function parseTtsAccent(value: unknown): TtsAccent {
  return value === 'uk' ? 'uk' : 'us'
}

export function voiceForAccent(accent: TtsAccent): string {
  if (accent === 'uk') return process.env.TTS_VOICE_UK || 'en-GB-SoniaNeural'
  return process.env.TTS_VOICE || 'en-US-JennyNeural'
}

/** US keeps the historical `name.mp3` cache. UK uses a separate suffix. */
export function cacheSuffix(accent: TtsAccent): string {
  return accent === 'uk' ? '.uk.mp3' : '.mp3'
}
