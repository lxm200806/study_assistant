import type { Request, Response } from 'express'
import QRCode from 'qrcode'
import {
  createPaymentOrder,
  createWechatPayment,
  getPaymentOrder,
  handleWechatNotification,
  listBillingPlans,
  listPaymentOrders,
  payPaymentOrder
} from '../services/billing.service'
import { validatedParams } from '../validation/validate'
import type { PaymentOrderParams, WechatPayBody } from '../validation/schemas'

function errorStatus(message: string): number {
  if (message === 'ORDER_NOT_FOUND') return 404
  if (message === 'PAYMENT_PROVIDER_NOT_CONFIGURED' || message === 'WECHAT_PAY_NOT_CONFIGURED') {
    return 503
  }
  if (message === 'ORDER_ALREADY_PAID') return 409
  if (message === 'MOCK_PAYMENT_DISABLED' || message === 'WECHAT_PAY_NOT_ENABLED') return 400
  return 400
}

export async function listPlansHandler(_req: Request, res: Response) {
  const plans = await listBillingPlans()
  res.json({ success: true, data: plans })
}

export async function listOrdersHandler(req: Request, res: Response) {
  const orders = await listPaymentOrders(req.userId!)
  res.json({ success: true, data: orders })
}

export async function createOrderHandler(req: Request, res: Response) {
  try {
    const order = await createPaymentOrder(req.userId!, String(req.body?.planCode || ''))
    res.status(201).json({ success: true, data: order })
  } catch (error) {
    const message = (error as Error).message
    res.status(errorStatus(message)).json({ success: false, error: message })
  }
}

export async function payOrderHandler(req: Request, res: Response) {
  try {
    const order = await payPaymentOrder(req.userId!, String(req.params.id || ''))
    res.json({ success: true, data: order })
  } catch (error) {
    const message = (error as Error).message
    res.status(errorStatus(message)).json({ success: false, error: message })
  }
}

export async function getOrderHandler(req: Request, res: Response) {
  try {
    const { id } = validatedParams<PaymentOrderParams>(res)
    const order = await getPaymentOrder(req.userId!, id)
    res.json({ success: true, data: order })
  } catch (error) {
    const message = (error as Error).message
    res.status(errorStatus(message)).json({ success: false, error: message })
  }
}

export async function wechatPayHandler(req: Request, res: Response) {
  try {
    const { id } = validatedParams<PaymentOrderParams>(res)
    const { channel } = req.body as WechatPayBody
    const result = await createWechatPayment(req.userId!, id, channel, req.ip)

    if (result.channel === 'native') {
      const qrCodeDataUrl = await QRCode.toDataURL(result.codeUrl, {
        width: 280,
        margin: 1,
        errorCorrectionLevel: 'M'
      })
      return res.json({ success: true, data: { ...result, qrCodeDataUrl } })
    }

    res.json({ success: true, data: result })
  } catch (error) {
    const message = (error as Error).message
    res.status(errorStatus(message)).json({ success: false, error: message })
  }
}

/**
 * 微信支付回调：不能经过 Bearer 鉴权，必须用微信平台证书验签。
 * 返回微信要求的 { code: 'SUCCESS' } 格式。
 */
export async function wechatNotifyHandler(req: Request, res: Response) {
  try {
    if (!req.rawBody) {
      return res.status(400).json({ code: 'FAIL', message: 'missing raw body' })
    }
    await handleWechatNotification(
      req.headers as Record<string, string | string[] | undefined>,
      req.rawBody
    )
    res.status(200).json({ code: 'SUCCESS', message: '成功' })
  } catch (error) {
    console.error('[billing] wechat notify failed:', (error as Error).message)
    const status = (error as { status?: number }).status || 401
    res.status(status).json({ code: 'FAIL', message: '验签或处理失败' })
  }
}
