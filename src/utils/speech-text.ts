/** True when transcript has enough letters to send as chat/speech input. */
export function isMeaningfulSpeechText(text: string, minLetters = 2): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const letters = trimmed.match(/[a-zA-Z\u4e00-\u9fff]/g)
  return !!letters && letters.length >= minLetters
}
