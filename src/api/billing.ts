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
  planSnapshot?: unknown
  createdAt: string
  paidAt?: string | null
}

export const billingAPI = {
  plans: async () => request<BillingPlan[]>('/billing/plans', 'GET'),
  orders: async () => request<PaymentOrder[]>('/billing/orders', 'GET'),
  createOrder: async (planCode: string) =>
    request<PaymentOrder>('/billing/orders', 'POST', { planCode }),
  payOrder: async (id: string) =>
    request<PaymentOrder>(`/billing/orders/${id}/pay`, 'POST', { provider: 'mock' })
}
