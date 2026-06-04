import crypto from 'crypto'

const XFYUN_HOST = 'iat-api.xfyun.cn'

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

type WsLike = {
  send: (data: string) => void
  close: () => void
  addEventListener: (event: string, listener: (ev: { data?: unknown }) => void) => void
}

export class XfyunAsrSession {
  private ws: WsLike | null = null
  private partial = ''
  private finalText = ''
  private closed = false
  private ready: Promise<void>
  private resolveReady!: () => void
  private rejectReady!: (err: Error) => void

  constructor(private readonly appId: string) {
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
  }

  async connect(): Promise<void> {
    const WebSocketCtor = (globalThis as { WebSocket?: new (url: string) => WsLike }).WebSocket
    if (!WebSocketCtor) {
      throw new Error('WEBSOCKET_NOT_AVAILABLE')
    }

    const url = buildXfyunAuthUrl()
    this.ws = new WebSocketCtor(url)

    this.ws.addEventListener('open', () => {
      this.sendFrame({
        common: { app_id: this.appId },
        business: {
          language: 'en_us',
          domain: 'iat',
          accent: 'mandarin',
          vad_eos: 2500,
          dwa: 'wpgs'
        },
        data: {
          status: 0,
          format: 'audio/L16;rate=16000',
          encoding: 'lame',
          audio: ''
        }
      })
      this.resolveReady()
    })

    this.ws.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as { code?: number; data?: { status?: number } }
        if (payload.code !== 0) return
        const text = extractXfyunText(payload)
        if (text) {
          this.partial = text
          if (payload.data?.status === 2) {
            this.finalText = text
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
        encoding: 'lame',
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
    await new Promise(r => setTimeout(r, 300))
    return this.getPartialText()
  }
}

export function createXfyunSession(): XfyunAsrSession {
  const appId = process.env.XFYUN_APP_ID
  if (!appId) throw new Error('XFYUN_NOT_CONFIGURED')
  return new XfyunAsrSession(appId)
}
