import {
  createCipheriv,
  createSign,
  createVerify,
  generateKeyPairSync
} from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  WechatPayClient,
  WechatPayError,
  type WechatPayConfig
} from './wechat-pay.service'

const API_V3_KEY = '0123456789abcdef0123456789abcdef'
const SERIAL = 'platform-serial-1'

function keys() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
}

const merchantKeys = keys()
const platformKeys = keys()

function config(overrides: Partial<WechatPayConfig> = {}): WechatPayConfig {
  return {
    mchid: 'mch-1',
    appid: 'wx-app-1',
    apiV3Key: API_V3_KEY,
    serialNo: 'merchant-serial-1',
    privateKeyPem: merchantKeys.privateKey,
    notifyUrl: 'https://example.com/api/billing/wechat/notify',
    platformCerts: { [SERIAL]: platformKeys.publicKey },
    apiBase: 'https://api.mch.weixin.qq.com',
    description: '学习助手会员',
    h5AppName: '学习助手',
    h5AppUrl: 'https://example.com',
    ...overrides
  }
}

function fetchResponse(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  })) as unknown as typeof fetch
}

function signedNotify(
  plaintext: Record<string, unknown>,
  options: { timestamp?: string; signatureKey?: string; associatedData?: string } = {}
) {
  const nonce = 'notify-nonce-1'
  const associatedData = options.associatedData ?? 'transaction'
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(API_V3_KEY), Buffer.from(nonce))
  cipher.setAAD(Buffer.from(associatedData))
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(plaintext), 'utf8'),
    cipher.final()
  ])
  const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64')
  const payload = {
    id: 'notify-1',
    event_type: 'TRANSACTION.SUCCESS',
    resource: {
      algorithm: 'AEAD_AES_256_GCM',
      ciphertext,
      nonce,
      associated_data: associatedData
    }
  }
  const rawBody = JSON.stringify(payload)
  const timestamp = options.timestamp ?? '1700000000'
  const message = `${timestamp}\n${nonce}\n${rawBody}\n`
  const signature = createSign('RSA-SHA256')
    .update(message)
    .sign(options.signatureKey || platformKeys.privateKey, 'base64')
  return {
    rawBody,
    timestamp,
    headers: {
      'wechatpay-timestamp': timestamp,
      'wechatpay-nonce': nonce,
      'wechatpay-signature': signature,
      'wechatpay-serial': SERIAL
    }
  }
}

describe('WechatPayClient', () => {
  it('creates a Native payment and signs the request', async () => {
    const fetchImpl = fetchResponse({
      prepay_id: 'prepay-1',
      code_url: 'weixin://wxpay/bizpayurl?pr=abc'
    })
    const client = new WechatPayClient(config(), fetchImpl)

    const result = await client.createPayment({
      outTradeNo: 'order-1',
      amountCents: 2_990,
      channel: 'native'
    })

    expect(result).toMatchObject({
      channel: 'native',
      prepayId: 'prepay-1',
      codeUrl: 'weixin://wxpay/bizpayurl?pr=abc'
    })
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string }
    ]
    expect(url).toBe('https://api.mch.weixin.qq.com/v3/pay/transactions/native')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body) as Record<string, unknown>
    expect(body).toMatchObject({
      appid: 'wx-app-1',
      mchid: 'mch-1',
      out_trade_no: 'order-1',
      amount: { total: 2_990, currency: 'CNY' }
    })

    const authorization = init.headers.Authorization
    const value = (name: string) =>
      authorization.match(new RegExp(`${name}="([^"]+)"`))?.[1] || ''
    const timestamp = value('timestamp')
    const nonce = value('nonce_str')
    const signature = value('signature')
    expect(value('mchid')).toBe('mch-1')
    const message = `POST\n/v3/pay/transactions/native\n${timestamp}\n${nonce}\n${init.body}\n`
    expect(
      createVerify('RSA-SHA256').update(message).verify(merchantKeys.publicKey, signature, 'base64')
    ).toBe(true)
  })

  it('creates an H5 payment with scene info and redirect', async () => {
    const fetchImpl = fetchResponse({ h5_url: 'https://wx.example/h5?foo=1' })
    const client = new WechatPayClient(
      config({ h5RedirectUrl: 'https://example.com/pay-return' }),
      fetchImpl
    )

    const result = await client.createPayment({
      outTradeNo: 'order-2',
      amountCents: 19_900,
      channel: 'h5',
      clientIp: '1.2.3.4'
    })

    expect(result.channel).toBe('h5')
    if (result.channel === 'h5') {
      expect(result.h5Url).toContain('redirect_url=https%3A%2F%2Fexample.com%2Fpay-return')
    }
    const body = JSON.parse(
      (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string
    ) as { scene_info: { payer_client_ip: string; h5_info: { type: string } } }
    expect(body.scene_info).toMatchObject({
      payer_client_ip: '1.2.3.4',
      h5_info: { type: 'Wap' }
    })
  })

  it('queries a transaction by out_trade_no', async () => {
    const fetchImpl = fetchResponse({
      trade_state: 'SUCCESS',
      transaction_id: 'wx-tx-1',
      appid: 'wx-app-1',
      mchid: 'mch-1',
      out_trade_no: 'order-1',
      amount: { total: 2_990 }
    })
    const client = new WechatPayClient(config(), fetchImpl)

    const result = await client.queryOrder('order-1')

    expect(result).toMatchObject({
      tradeState: 'SUCCESS',
      transactionId: 'wx-tx-1',
      amountCents: 2_990
    })
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    expect(url).toContain('/v3/pay/transactions/out-trade-no/order-1?mchid=mch-1')
  })

  it('verifies and decrypts a payment notification', () => {
    const client = new WechatPayClient(config())
    const notify = signedNotify({
      appid: 'wx-app-1',
      mchid: 'mch-1',
      out_trade_no: 'order-1',
      transaction_id: 'wx-tx-1',
      trade_state: 'SUCCESS',
      amount: { total: 2_990 },
      success_time: '2026-01-01T00:00:00+08:00'
    })

    const result = client.verifyNotification(
      notify.headers,
      notify.rawBody,
      Number(notify.timestamp)
    )

    expect(result.eventType).toBe('TRANSACTION.SUCCESS')
    expect(result.resource).toMatchObject({
      outTradeNo: 'order-1',
      transactionId: 'wx-tx-1',
      tradeState: 'SUCCESS',
      amountCents: 2_990
    })
  })

  it('rejects a notification with an invalid signature', () => {
    const client = new WechatPayClient(config())
    const notify = signedNotify(
      { out_trade_no: 'order-1', trade_state: 'SUCCESS' },
      { signatureKey: merchantKeys.privateKey }
    )

    expect(() =>
      client.verifyNotification(notify.headers, notify.rawBody, Number(notify.timestamp))
    ).toThrow(WechatPayError)
  })

  it('returns a clear error for WeChat API failures', async () => {
    const fetchImpl = fetchResponse({ code: 'PARAM_ERROR', message: 'bad amount' }, 400)
    const client = new WechatPayClient(config(), fetchImpl)

    await expect(
      client.createPayment({ outTradeNo: 'order-1', amountCents: 100, channel: 'native' })
    ).rejects.toMatchObject({ code: 'PARAM_ERROR', status: 400 })
  })
})
