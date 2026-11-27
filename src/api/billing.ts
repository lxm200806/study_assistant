import { request } from './client'

export interface BillingPlanPermission {
  permissionKey: string
  limitValue?: number | null
  period?: string | null
}

export interface BillingPlan {
  code: string
  name: string
  kind?: string
  subject?: string
  groupKey?: string | null
  description?: string
  days: number
  priceCents: number
  creditAmount?: number
  active?: boolean
  sortOrder?: number
  permissions?: BillingPlanPermission[]
}

export interface PaymentOrder {
  id: string
  planCode: string
  amountCents: number
  status: string
  provider: string
  channel?: string | null
  payAppId?: string | null
  prepayId?: string | null
  planSnapshot?: unknown
  createdAt: string
  paidAt?: string | null
}

export interface WechatPaymentData {
  channel: 'native' | 'h5'
  appid: string
  prepayId: string
  codeUrl?: string
  h5Url?: string
  qrCodeDataUrl?: string
}

export const billingAPI = {
  plans: async () => request<BillingPlan[]>('/billing/plans', 'GET'),
  orders: async () => request<PaymentOrder[]>('/billing/orders', 'GET'),
  createOrder: async (planCode: string) =>
    request<PaymentOrder>('/billing/orders', 'POST', { planCode }),
  order: async (id: string) => request<PaymentOrder>(`/billing/orders/${id}`, 'GET'),
  wechatPay: async (id: string, channel: 'native' | 'h5') =>
    request<WechatPaymentData>(`/billing/orders/${id}/wechat-pay`, 'POST', { channel }),
  payOrder: async (id: string) =>
    request<PaymentOrder>(`/billing/orders/${id}/pay`, 'POST', { provider: 'mock' })
}
