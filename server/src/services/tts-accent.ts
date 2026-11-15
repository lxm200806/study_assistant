export type TtsAccent = 'us' | 'uk'
export type TtsGender = 'female' | 'male'

export function parseTtsAccent(value: unknown): TtsAccent {
  return value === 'uk' ? 'uk' : 'us'
}

export function parseTtsGender(value: unknown): TtsGender {
  return value === 'male' ? 'male' : 'female'
}

export function voiceForAccent(accent: TtsAccent, gender: TtsGender = 'female'): string {
  if (accent === 'uk') {
    if (gender === 'male') return process.env.TTS_VOICE_UK_MALE || 'en-GB-RyanNeural'
    return process.env.TTS_VOICE_UK || 'en-GB-SoniaNeural'
  }
  if (gender === 'male') return process.env.TTS_VOICE_MALE || 'en-US-GuyNeural'
  return process.env.TTS_VOICE || 'en-US-JennyNeural'
}

/** US female keeps the historical `name.mp3` cache; other variants use suffixes. */
export function cacheSuffix(accent: TtsAccent, gender: TtsGender = 'female'): string {
  if (gender === 'male') return accent === 'uk' ? '.uk.male.mp3' : '.male.mp3'
  return accent === 'uk' ? '.uk.mp3' : '.mp3'
}
