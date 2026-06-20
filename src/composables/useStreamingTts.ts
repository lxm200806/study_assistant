import { speakText, stopSpeak, isSpeakableForTts } from '@/utils/tts'
import { splitTextForTts } from '@/utils/tts-text'

/** 流式文本里的换行压成空格，避免在 "lunch\n every day" 处误断句 */
function normalizeStreamText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n+/g, ' ')
}

function stripLeadingMarkup(text: string): string {
  return text.replace(/^[\s\u2192\-*"'\u2018\u2019\u201C\u201D]+/, '').trim()
}

function looksLikeContinuation(text: string): boolean {
  return /^[a-z('"0-9]/.test(text.trim())
}

function endsSentence(text: string): boolean {
  return /[.!?]["']?$/.test(text.trim())
}

export function useStreamingTts() {
  let buffer = ''
  const queue: string[] = []
  let playing = false
  let stopped = false

  const pushSpeakable = (part: string) => {
    const cleaned = part.trim()
    if (!isSpeakableForTts(cleaned)) return

    const last = queue[queue.length - 1]
    if (last && !endsSentence(last) && looksLikeContinuation(cleaned)) {
      queue[queue.length - 1] = `${last} ${cleaned}`
      return
    }
    queue.push(cleaned)
  }

  const enqueue = (text: string) => {
    const normalized = stripLeadingMarkup(normalizeStreamText(text))
    if (!normalized) return
    for (const part of splitTextForTts(normalized)) {
      pushSpeakable(part)
    }
  }

  const extractSentences = (flushAll = false) => {
    buffer = normalizeStreamText(buffer).replace(/\s+/g, ' ')

    // 只在句号/问号/叹号处断句，不用单个换行
    const pattern = /[.!?。！？](?=\s|$|"|\*)/
    while (true) {
      const match = buffer.match(pattern)
      if (!match || match.index === undefined) break
      const idx = match.index
      const sentence = buffer.slice(0, idx + 1)
      buffer = buffer.slice(idx + 1)
      enqueue(sentence)
    }

    buffer = stripLeadingMarkup(buffer)

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
    buffer += normalizeStreamText(chunk)
    extractSentences(false)
    void playQueue()
  }

  const flush = async () => {
    extractSentences(true)
    while (!stopped) {
      await playQueue()
      if (!playing && queue.length === 0) break
      await new Promise(r => setTimeout(r, 40))
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
