import crypto from 'crypto'
import WebSocket from 'ws'

const XFYUN_HOST = 'iat-api.xfyun.cn'
export type XfyunAudioEncoding = 'lame' | 'raw'

function buildXfyunAuthUrl(): string {
  const apiKey = process.env.XFYUN_API_KEY!
  const apiSecret = process.env.XFYUN_API_SECRET!
  const date = new Date().toUTCString()
  const signatureOrigin = `host: ${XFYUN_HOST}\ndate: ${date}\nGET /v2/iat HTTP/1.1`
  const signature = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64')
  const authorization = Buffer.from(
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  ).toString('base64')
  return `wss://${XFYUN_HOST}/v2/iat?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${XFYUN_HOST}`
}

function extractXfyunText(payload: unknown): string {
  const data = payload as {
    data?: {
      result?: {
        ws?: Array<{ cw?: Array<{ w?: string }> }>
      }
    }
  }
  const ws = data?.data?.result?.ws
  if (!ws) return ''
  return ws.map(item => item.cw?.map(c => c.w || '').join('') || '').join('')
}

export function isPunctuationOnly(text: string): boolean {
  return /^[\s.,!?;:'"()\-—…]+$/.test(text)
}

export function mergeXfyunSegment(current: string, incoming: string, isFinal: boolean): string {
  if (!incoming) return current
  if (!current) return incoming

  // Final frame is often punctuation-only; keep the sentence and append it.
  if (isFinal && isPunctuationOnly(incoming)) {
    return current + incoming
  }

  // Streaming frames are usually cumulative; prefer the longer / richer result.
  if (incoming.length >= current.length || incoming.includes(current)) {
    return incoming
  }

  return current
}

type WsLike = {
  send: (data: string) => void
  close: () => void
  addEventListener: (event: string, listener: (ev: { data?: unknown }) => void) => void
}

function createWebSocket(url: string): WsLike {
  const NativeWebSocket = (globalThis as { WebSocket?: new (url: string) => WsLike }).WebSocket
  if (NativeWebSocket) {
    return new NativeWebSocket(url)
  }

  const ws = new WebSocket(url)
  return {
    send: (data: string) => ws.send(data),
    close: () => ws.close(),
    addEventListener: (event: string, listener: (ev: { data?: unknown }) => void) => {
      if (event === 'open') ws.on('open', () => listener({}))
      if (event === 'message') ws.on('message', (data) => listener({ data }))
      if (event === 'error') ws.on('error', () => listener({}))
    }
  }
}

export class XfyunAsrSession {
  private ws: WsLike | null = null
  private partial = ''
  private finalText = ''
  private closed = false
  private ready: Promise<void>
  private resolveReady!: () => void
  private rejectReady!: (err: Error) => void

  constructor(
    private readonly appId: string,
    private readonly encoding: XfyunAudioEncoding = 'lame'
  ) {
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
  }

  async connect(): Promise<void> {
    const url = buildXfyunAuthUrl()
    this.ws = createWebSocket(url)

    this.ws.addEventListener('open', () => {
      this.sendFrame({
        common: { app_id: this.appId },
        business: {
          language: 'en_us',
          domain: 'iat',
          accent: 'mandarin',
          vad_eos: 2500
          // Note: dwa=wpgs is Chinese-only; enabling it for English yields junk like "." or "?"
        },
        data: {
          status: 0,
          format: 'audio/L16;rate=16000',
          encoding: this.encoding,
          audio: ''
        }
      })
      this.resolveReady()
    })

    this.ws.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as { code?: number; message?: string; data?: { status?: number } }
        if (payload.code !== 0) {
          console.error('[xfyun-asr]', payload.code, payload.message)
          return
        }
        const text = extractXfyunText(payload)
        const isFinal = payload.data?.status === 2
        if (text) {
          this.partial = mergeXfyunSegment(this.partial, text, isFinal)
          if (isFinal) {
            this.finalText = this.partial
          }
        }
      } catch {
        // ignore
      }
    })

    this.ws.addEventListener('error', () => {
      this.rejectReady(new Error('XFYUN_WS_ERROR'))
    })

    await this.ready
  }

  private sendFrame(frame: object): void {
    if (!this.ws || this.closed) return
    this.ws.send(JSON.stringify(frame))
  }

  sendAudioChunk(audioBase64: string, isLast = false): void {
    this.sendFrame({
      data: {
        status: isLast ? 2 : 1,
        format: 'audio/L16;rate=16000',
        encoding: this.encoding,
        audio: audioBase64
      }
    })
  }

  getPartialText(): string {
    return this.finalText || this.partial
  }

  async close(): Promise<string> {
    if (this.closed) return this.getPartialText()
    this.closed = true
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // ignore
      }
    }
    await new Promise(r => setTimeout(r, 800))
    return this.getPartialText()
  }
}

export function createXfyunSession(encoding: XfyunAudioEncoding = 'lame'): XfyunAsrSession {
  const appId = process.env.XFYUN_APP_ID
  if (!appId) throw new Error('XFYUN_NOT_CONFIGURED')
  return new XfyunAsrSession(appId, encoding)
}

const XFYUN_CHUNK_SIZE = 8000

export async function transcribeWithXfyun(
  audioBase64: string,
  encoding: XfyunAudioEncoding = 'lame'
): Promise<string> {
  if (!audioBase64) return ''

  const session = createXfyunSession(encoding)
  await session.connect()

  for (let i = 0; i < audioBase64.length; i += XFYUN_CHUNK_SIZE) {
    const chunk = audioBase64.slice(i, i + XFYUN_CHUNK_SIZE)
    const isLast = i + XFYUN_CHUNK_SIZE >= audioBase64.length
    session.sendAudioChunk(chunk, isLast)
    if (!isLast) {
      await new Promise(r => setTimeout(r, 40))
    } else {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return (await session.close()).trim()
}
