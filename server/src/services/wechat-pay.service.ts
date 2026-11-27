import fs from 'node:fs'
import { createDecipheriv, createSign, createVerify, randomBytes } from 'node:crypto'

export type WechatPayChannel = 'native' | 'h5'

export interface WechatPayConfig {
  mchid: string
  appid: string
  apiV3Key: string
  serialNo: string
  privateKeyPem: string
  notifyUrl: string
  platformCerts: Record<string, string>
  apiBase: string
  description: string
  h5AppName: string
  h5AppUrl: string
  h5RedirectUrl?: string
}

export interface WechatNativePayment {
  channel: 'native'
  appid: string
  prepayId: string
  codeUrl: string
}

export interface WechatH5Payment {
  channel: 'h5'
  appid: string
  prepayId: string
  h5Url: string
}

export type WechatPaymentResult = WechatNativePayment | WechatH5Payment

export interface WechatQueryResult {
  tradeState: string
  transactionId?: string
  amountCents?: number
  appid?: string
  mchid?: string
  outTradeNo?: string
  successTime?: string
}

export interface WechatNotifyResult {
  id: string
  eventType: string
  resource: {
    appid?: string
    mchid?: string
    outTradeNo?: string
    transactionId?: string
    tradeState?: string
    amountCents?: number
    successTime?: string
    [key: string]: unknown
  }
}

type FetchLike = typeof fetch

export class WechatPayError extends Error {
  constructor(
    message: string,
    readonly code = 'WECHAT_PAY_ERROR',
    readonly status?: number
  ) {
    super(message)
    this.name = 'WechatPayError'
  }
}

function envValue(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return ''
}

function loadPrivateKey(): string {
  const inline = envValue('WECHAT_PAY_PRIVATE_KEY')
  if (inline) return inline.replace(/\\n/g, '\n')
  const path = envValue('WECHAT_PAY_PRIVATE_KEY_PATH')
  if (path && fs.existsSync(path)) return fs.readFileSync(path, 'utf8')
  return ''
}

function loadPlatformCerts(): Record<string, string> {
  const raw = envValue('WECHAT_PAY_PLATFORM_CERTS')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      // fall through
    }
  }

  const path = envValue('WECHAT_PAY_PLATFORM_CERTS_PATH')
  if (path && fs.existsSync(path)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path, 'utf8')) as Record<string, string>
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      // fall through
    }
  }

  const singleCert = envValue('WECHAT_PAY_PLATFORM_CERT')
  const singleSerial = envValue('WECHAT_PAY_PLATFORM_SERIAL')
  if (singleCert && singleSerial) {
    return { [singleSerial]: singleCert.replace(/\\n/g, '\n') }
  }
  return {}
}

export function getWechatPayConfig(): WechatPayConfig | null {
  const mchid = envValue('WECHAT_PAY_MCHID')
  const appid = envValue('WECHAT_PAY_APPID')
  const apiV3Key = envValue('WECHAT_PAY_API_V3_KEY')
  const serialNo = envValue('WECHAT_PAY_MCH_SERIAL_NO')
  const privateKeyPem = loadPrivateKey()
  const notifyUrl = envValue('WECHAT_PAY_NOTIFY_URL')
  const platformCerts = loadPlatformCerts()

  if (
    !mchid ||
    !appid ||
    apiV3Key.length !== 32 ||
    !serialNo ||
    !privateKeyPem ||
    !notifyUrl ||
    Object.keys(platformCerts).length === 0
  ) {
    return null
  }

  return {
    mchid,
    appid,
    apiV3Key,
    serialNo,
    privateKeyPem,
    notifyUrl,
    platformCerts,
    apiBase: envValue('WECHAT_PAY_API_BASE') || 'https://api.mch.weixin.qq.com',
    description: envValue('WECHAT_PAY_DESCRIPTION') || '学习助手会员',
    h5AppName: envValue('WECHAT_PAY_H5_APP_NAME') || '学习助手',
    h5AppUrl: envValue('WECHAT_PAY_H5_APP_URL') || 'https://study.example.com',
    h5RedirectUrl: envValue('WECHAT_PAY_H5_REDIRECT_URL') || undefined
  }
}

export function isWechatPayConfigured(): boolean {
  return getWechatPayConfig() !== null
}

export function assertWechatPayConfigured(): WechatPayConfig {
  const config = getWechatPayConfig()
  if (!config) {
    throw new WechatPayError('微信支付未配置', 'WECHAT_PAY_NOT_CONFIGURED')
  }
  return config
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  key: string
): string {
  const value = headers[key] ?? headers[key.toLowerCase()]
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export class WechatPayClient {
  constructor(
    private readonly config: WechatPayConfig,
    private readonly fetchImpl: FetchLike = globalThis.fetch.bind(globalThis)
  ) {}

  get appid(): string {
    return this.config.appid
  }

  get mchid(): string {
    return this.config.mchid
  }

  async createPayment(input: {
    outTradeNo: string
    amountCents: number
    channel: WechatPayChannel
    clientIp?: string
    description?: string
  }): Promise<WechatPaymentResult> {
    const base = {
      appid: this.config.appid,
      mchid: this.config.mchid,
      description: input.description || this.config.description,
      out_trade_no: input.outTradeNo,
      notify_url: this.config.notifyUrl,
      amount: { total: input.amountCents, currency: 'CNY' }
    }

    if (input.channel === 'native') {
      const data = await this.request<{ prepay_id: string; code_url: string }>(
        'POST',
        '/v3/pay/transactions/native',
        base
      )
      return {
        channel: 'native',
        appid: this.config.appid,
        prepayId: data.prepay_id,
        codeUrl: data.code_url
      }
    }

    const body = {
      ...base,
      scene_info: {
        payer_client_ip: input.clientIp || '127.0.0.1',
        h5_info: {
          type: 'Wap',
          app_name: this.config.h5AppName,
          app_url: this.config.h5AppUrl
        }
      }
    }
    const data = await this.request<{ h5_url: string; prepay_id?: string }>(
      'POST',
      '/v3/pay/transactions/h5',
      body
    )
    let h5Url = data.h5_url
    if (this.config.h5RedirectUrl) {
      h5Url += `${h5Url.includes('?') ? '&' : '?'}redirect_url=${encodeURIComponent(
        this.config.h5RedirectUrl
      )}`
    }
    return {
      channel: 'h5',
      appid: this.config.appid,
      prepayId: data.prepay_id || '',
      h5Url
    }
  }

  async queryOrder(orderId: string): Promise<WechatQueryResult> {
    const data = await this.request<{
      trade_state: string
      transaction_id?: string
      amount?: { total?: number }
      appid?: string
      mchid?: string
      out_trade_no?: string
      success_time?: string
    }>(
      'GET',
      `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderId)}?mchid=${encodeURIComponent(
        this.config.mchid
      )}`
    )
    return {
      tradeState: data.trade_state,
      transactionId: data.transaction_id,
      amountCents: data.amount?.total,
      appid: data.appid,
      mchid: data.mchid,
      outTradeNo: data.out_trade_no,
      successTime: data.success_time
    }
  }

  /**
   * 验证微信支付回调签名并解密 resource。
   * rawBody 必须是微信 POST 的原始 JSON 字符串。
   */
  verifyNotification(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    nowSeconds = Math.floor(Date.now() / 1000)
  ): WechatNotifyResult {
    const timestamp = headerValue(headers, 'wechatpay-timestamp')
    const nonce = headerValue(headers, 'wechatpay-nonce')
    const signature = headerValue(headers, 'wechatpay-signature')
    const serial = headerValue(headers, 'wechatpay-serial')
    if (!timestamp || !nonce || !signature || !serial) {
      throw new WechatPayError('微信回调缺少签名头', 'WECHAT_PAY_INVALID_SIGNATURE', 401)
    }
    const timestampNumber = Number(timestamp)
    if (!Number.isFinite(timestampNumber) || Math.abs(nowSeconds - timestampNumber) > 300) {
      throw new WechatPayError('微信回调时间戳无效', 'WECHAT_PAY_INVALID_SIGNATURE', 401)
    }

    const cert = this.config.platformCerts[serial]
    if (!cert) {
      throw new WechatPayError('未知的微信支付平台证书序列号', 'WECHAT_PAY_UNKNOWN_CERT', 401)
    }
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`
    const verified = createVerify('RSA-SHA256')
      .update(message)
      .verify(cert, Buffer.from(signature, 'base64'))
    if (!verified) {
      throw new WechatPayError('微信回调签名校验失败', 'WECHAT_PAY_INVALID_SIGNATURE', 401)
    }

    const payload = JSON.parse(rawBody) as {
      id?: string
      event_type?: string
      resource?: {
        algorithm?: string
        ciphertext?: string
        nonce?: string
        associated_data?: string
      }
    }
    if (!payload.resource?.ciphertext) {
      throw new WechatPayError('微信回调缺少 resource', 'WECHAT_PAY_INVALID_NOTIFY', 400)
    }

    const decrypted = this.decryptResource(payload.resource)
    return {
      id: String(payload.id || ''),
      eventType: String(payload.event_type || ''),
      resource: {
        ...decrypted,
        amountCents: Number(
          (decrypted.amount as { total?: number } | undefined)?.total ?? NaN
        ),
        outTradeNo: typeof decrypted.out_trade_no === 'string' ? decrypted.out_trade_no : undefined,
        transactionId:
          typeof decrypted.transaction_id === 'string' ? decrypted.transaction_id : undefined,
        tradeState: typeof decrypted.trade_state === 'string' ? decrypted.trade_state : undefined,
        successTime: typeof decrypted.success_time === 'string' ? decrypted.success_time : undefined
      }
    }
  }

  private decryptResource(resource: {
    ciphertext?: string
    nonce?: string
    associated_data?: string
  }): Record<string, unknown> {
    if (!resource.ciphertext || !resource.nonce) {
      throw new WechatPayError('微信回调 resource 不完整', 'WECHAT_PAY_INVALID_NOTIFY', 400)
    }
    const key = Buffer.from(this.config.apiV3Key, 'utf8')
    if (key.length !== 32) {
      throw new WechatPayError('WECHAT_PAY_API_V3_KEY 必须为 32 字节', 'WECHAT_PAY_NOT_CONFIGURED')
    }
    const data = Buffer.from(resource.ciphertext, 'base64')
    if (data.length <= 16) {
      throw new WechatPayError('微信回调密文长度无效', 'WECHAT_PAY_INVALID_NOTIFY', 400)
    }
    const authTag = data.subarray(data.length - 16)
    const ciphertext = data.subarray(0, data.length - 16)
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(resource.nonce, 'utf8'))
    decipher.setAuthTag(authTag)
    if (resource.associated_data) {
      decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'))
    }
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    return JSON.parse(plaintext) as Record<string, unknown>
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const bodyText = body === undefined ? '' : JSON.stringify(body)
    const authorization = this.authorization(method, path, bodyText)
    const response = await this.fetchImpl(`${this.config.apiBase}${path}`, {
      method,
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'study-assistant-wechat-pay'
      },
      body: bodyText || undefined,
      signal: AbortSignal.timeout(15_000)
    })
    const text = await response.text()
    let data: Record<string, unknown> = {}
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    } catch {
      data = { raw: text }
    }
    if (!response.ok) {
      const code = typeof data.code === 'string' ? data.code : `HTTP_${response.status}`
      const message = typeof data.message === 'string' ? data.message : '微信支付请求失败'
      throw new WechatPayError(message, code, response.status)
    }
    return data as T
  }

  private authorization(method: string, path: string, body: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = randomBytes(16).toString('hex')
    const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`
    const signature = createSign('RSA-SHA256')
      .update(message)
      .sign(this.config.privateKeyPem, 'base64')
    return (
      'WECHATPAY2-SHA256-RSA2048 ' +
      `mchid="${this.config.mchid}",nonce_str="${nonce}",signature="${signature}",` +
      `timestamp="${timestamp}",serial_no="${this.config.serialNo}"`
    )
  }
}

let cachedClient: WechatPayClient | null = null

export function getWechatPayClient(): WechatPayClient {
  if (!cachedClient) {
    cachedClient = new WechatPayClient(assertWechatPayConfigured())
  }
  return cachedClient
}

/** 测试或热更新配置后使用。 */
export function resetWechatPayClient(): void {
  cachedClient = null
}
