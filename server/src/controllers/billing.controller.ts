import type { Request, Response } from 'express'
import {
  createPaymentOrder,
  listBillingPlans,
  listPaymentOrders,
  payPaymentOrder
} from '../services/billing.service'

function errorStatus(message: string): number {
  if (message === 'ORDER_NOT_FOUND') return 404
  if (message === 'PAYMENT_PROVIDER_NOT_CONFIGURED') return 503
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
