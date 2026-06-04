import { speakText, stopSpeak } from '@/utils/tts'

export function useStreamingTts() {
  let buffer = ''
  const queue: string[] = []
  let playing = false
  let stopped = false

  const enqueue = (text: string) => {
    const trimmed = text.trim()
    if (trimmed.length >= 2) queue.push(trimmed)
  }

  const extractSentences = (flushAll = false) => {
    const pattern = /[.!?。！？\n]/
    while (true) {
      const idx = buffer.search(pattern)
      if (idx < 0) break
      const sentence = buffer.slice(0, idx + 1)
      buffer = buffer.slice(idx + 1)
      enqueue(sentence)
    }
    if (flushAll && buffer.trim()) {
      enqueue(buffer)
      buffer = ''
    }
  }

  const playQueue = async () => {
    if (playing) return
    playing = true
    while (queue.length > 0 && !stopped) {
      const sentence = queue.shift()!
      try {
        await speakText(sentence)
      } catch {
        // skip failed sentence
      }
    }
    playing = false
  }

  const feed = (chunk: string) => {
    if (stopped) return
    buffer += chunk
    extractSentences(false)
    void playQueue()
  }

  const flush = async () => {
    extractSentences(true)
    await playQueue()
    while (playing) {
      await new Promise(r => setTimeout(r, 60))
    }
  }

  const reset = () => {
    stopped = false
    buffer = ''
    queue.length = 0
    stopSpeak()
    playing = false
  }

  const stop = () => {
    stopped = true
    buffer = ''
    queue.length = 0
    stopSpeak()
    playing = false
  }

  return { feed, flush, reset, stop }
}
